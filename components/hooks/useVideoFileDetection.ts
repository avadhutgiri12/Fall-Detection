"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFrameStreamDetection, type DetectionResult } from "./useFrameStreamDetection";
import { useVideoCache } from "./useVideoCache";

export type { DetectionResult };

export interface VideoFrame {
  index: number;
  blob: Blob;
  timestamp: number;
}

export interface UseVideoFileDetectionOptions {
  wsUrl?: string;
  apiUrl?: string;
  fps?: number;
  maxResolution?: number;
  confThreshold?: number;
  sessionId?: string;
  onFrameResult?: (result: DetectionResult) => void;
  onFrameError?: (frameIndex: number, error: Error) => void;
  onFallDetected?: (score: number, frameIndex: number) => void;
  onProgress?: (progress: number) => void;
  onComplete?: (results: DetectionResult[]) => void;
  onError?: (error: string) => void;
}

export interface UseVideoFileDetectionReturn {
  isProcessing: boolean;
  isConnected: boolean;
  currentFrame: number;
  totalFrames: number;
  framesSent: number;
  framesReceived: number;
  progress: number;
  error: string | null;
  results: DetectionResult[];
  confThreshold: number;
  processVideo: (videoFile: File) => Promise<DetectionResult[]>;
  cancelProcessing: () => void;
  reset: () => void;
  setConfThreshold: (value: number) => void;
}

const CONNECTION_TIMEOUT_MS = 15_000;
const FRAME_RESPONSE_TIMEOUT_MS = 12_000;
const SEND_RETRY_INTERVAL_MS = 50;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useVideoFileDetection({
  wsUrl,
  fps = 10,
  maxResolution = 640,
  confThreshold: initialConfThreshold = 0.6,
  sessionId,
  onFrameResult,
  onFrameError,
  onFallDetected,
  onProgress,
  onComplete,
  onError,
}: UseVideoFileDetectionOptions = {}): UseVideoFileDetectionReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [confThreshold, setConfThresholdState] = useState(initialConfThreshold);

  const processingRef = useRef(false);
  const cancelRef = useRef(false);
  const connectedRef = useRef(false);
  const resultsRef = useRef<DetectionResult[]>([]);
  const completedFrameIndicesRef = useRef<Set<number>>(new Set());
  const callbacksRef = useRef({ onFrameResult, onFrameError, onFallDetected, onProgress, onComplete, onError });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const { saveChunk, clearSessionCache } = useVideoCache();

  useEffect(() => {
    callbacksRef.current = { onFrameResult, onFrameError, onFallDetected, onProgress, onComplete, onError };
  }, [onFrameResult, onFrameError, onFallDetected, onProgress, onComplete, onError]);

  const {
    isConnected: socketConnected,
    framesSent,
    framesReceived,
    sendFrame,
    startDetection,
    stopDetection,
    setConfThreshold: setCoreConfThreshold,
    confThreshold: coreConfThreshold,
  } = useFrameStreamDetection({
    wsUrl: wsUrl || "",
    confThreshold: initialConfThreshold,
    onFrameResult: (result) => {
      // Deduplicate by frame index: late/duplicate messages must not inflate summaries.
      if (!resultsRef.current.some((item) => item.frame_index === result.frame_index)) {
        resultsRef.current = [...resultsRef.current, result].sort((a, b) => a.frame_index - b.frame_index);
        setResults(resultsRef.current);
      }
      completedFrameIndicesRef.current.add(result.frame_index);
      callbacksRef.current.onFrameResult?.(result);

      if (sessionId && result.frame_index >= 0) {
        void saveChunk({
          sessionId,
          chunkIndex: Math.floor(result.frame_index / 10),
          frames: [{ index: result.frame_index, blob: new Blob(), timestamp: result.timestamp }],
          results: [{ boxes: result.boxes, scores: result.scores, falls: result.falls, timestamp: result.timestamp }],
        }).catch((err) => console.warn("[useVideoFileDetection] Cache save failed:", err));
      }
    },
    onFrameError: (frameIndex, err) => {
      completedFrameIndicesRef.current.add(frameIndex);
      callbacksRef.current.onFrameError?.(frameIndex, err);
    },
    onFallDetected: (score, frameIndex) => callbacksRef.current.onFallDetected?.(score, frameIndex),
  });

  useEffect(() => {
    connectedRef.current = socketConnected;
    setIsConnected(socketConnected);
  }, [socketConnected]);

  useEffect(() => setConfThresholdState(coreConfThreshold), [coreConfThreshold]);

  const waitForConnection = useCallback(async () => {
    const startedAt = Date.now();
    while (!connectedRef.current) {
      if (cancelRef.current) throw new Error("Processing cancelled.");
      if (Date.now() - startedAt > CONNECTION_TIMEOUT_MS) {
        throw new Error(`WebSocket connection timed out after ${CONNECTION_TIMEOUT_MS / 1000} seconds. Check the backend and NEXT_PUBLIC_WS_URL.`);
      }
      await sleep(100);
    }
  }, []);

  const captureFrame = useCallback(async (video: HTMLVideoElement, timestamp: number): Promise<Blob> => {
    const targetTime = Math.min(Math.max(timestamp, 0), Math.max(0, video.duration - 0.001));
    if (Math.abs(video.currentTime - targetTime) > 0.001) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out seeking to ${targetTime.toFixed(2)} seconds.`));
        }, 5000);
        const cleanup = () => {
          window.clearTimeout(timeout);
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onErrorEvent);
        };
        const onSeeked = () => { cleanup(); resolve(); };
        const onErrorEvent = () => { cleanup(); reject(new Error("Could not seek in the selected video.")); };
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onErrorEvent, { once: true });
        video.currentTime = targetTime;
      });
    }

    const canvas = document.createElement("canvas");
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error("The selected video has no readable video dimensions.");
    const scale = Math.min(maxResolution / width, maxResolution / height, 1);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a canvas context to extract video frames.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode the video frame.")), "image/jpeg", 0.82);
    });
    return blob;
  }, [maxResolution]);

  const blobToBase64 = useCallback((blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") return reject(new Error("Could not read the extracted frame."));
      resolve(value); // WebSocket backend receives a data URL, as in the existing protocol.
    };
    reader.onerror = () => reject(new Error("Failed to read the extracted frame."));
    reader.readAsDataURL(blob);
  }), []);

  const processVideo = useCallback(async (videoFile: File): Promise<DetectionResult[]> => {
    if (processingRef.current) throw new Error("A video is already being processed.");
    if (!wsUrl) throw new Error("WebSocket URL is required for video detection.");
    if (typeof document === "undefined") throw new Error("Video processing is only available in the browser.");
    if (!Number.isFinite(fps) || fps <= 0) throw new Error("FPS must be greater than zero.");

    processingRef.current = true;
    cancelRef.current = false;
    resultsRef.current = [];
    completedFrameIndicesRef.current = new Set();
    setIsProcessing(true);
    setError(null);
    setCurrentFrame(0);
    setTotalFrames(0);
    setProgress(0);
    setResults([]);

    let objectUrl: string | null = null;
    let video: HTMLVideoElement | null = null;

    try {
      objectUrl = URL.createObjectURL(videoFile);
      video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;
      videoRef.current = video;

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Timed out loading video metadata.")), 15_000);
        const cleanup = () => {
          window.clearTimeout(timeout);
          video?.removeEventListener("loadedmetadata", onLoaded);
          video?.removeEventListener("error", onVideoError);
        };
        const onLoaded = () => { cleanup(); resolve(); };
        const onVideoError = () => { cleanup(); reject(new Error("The browser could not load this video. Try converting it to MP4 (H.264).")); };
        video!.addEventListener("loadedmetadata", onLoaded, { once: true });
        video!.addEventListener("error", onVideoError, { once: true });
        if (video!.readyState >= 1) { cleanup(); resolve(); }
      });

      if (!video.duration || !Number.isFinite(video.duration)) throw new Error("The selected video has an invalid duration.");
      const frameCount = Math.max(1, Math.ceil(video.duration * fps));
      setTotalFrames(frameCount);

      startDetection(confThreshold);
      await waitForConnection();

      for (let index = 0; index < frameCount; index += 1) {
        if (cancelRef.current) break;
        const timestamp = Math.min(index / fps, Math.max(0, video.duration - 0.001));
        const blob = await captureFrame(video, timestamp);
        const base64 = await blobToBase64(blob);

        // Send one frame at a time. This respects the hook's single-pending-frame
        // protocol and avoids silently skipping frames when the socket is busy.
        const sendStartedAt = Date.now();
        let sent = false;
        while (!sent && !cancelRef.current) {
          if (Date.now() - sendStartedAt > CONNECTION_TIMEOUT_MS) {
            throw new Error(`Could not send frame ${index}; the WebSocket was not ready.`);
          }
          sent = sendFrame(base64, index, timestamp);
          if (!sent) await sleep(SEND_RETRY_INTERVAL_MS);
        }
        if (cancelRef.current) break;

        const responseStartedAt = Date.now();
        while (!completedFrameIndicesRef.current.has(index) && !cancelRef.current) {
          if (Date.now() - responseStartedAt > FRAME_RESPONSE_TIMEOUT_MS) {
            const timeoutError = new Error(`No detection result was received for frame ${index} within ${FRAME_RESPONSE_TIMEOUT_MS / 1000} seconds.`);
            callbacksRef.current.onFrameError?.(index, timeoutError);
            completedFrameIndicesRef.current.add(index);
            break;
          }
          await sleep(50);
        }

        const processedCount = index + 1;
        setCurrentFrame(processedCount);
        const nextProgress = processedCount / frameCount;
        setProgress(nextProgress);
        callbacksRef.current.onProgress?.(nextProgress);
      }

      const finalResults = [...resultsRef.current].sort((a, b) => a.frame_index - b.frame_index);
      setResults(finalResults);
      if (!cancelRef.current) {
        setProgress(1);
        callbacksRef.current.onComplete?.(finalResults);
      }
      return finalResults;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Video detection failed.";
      if (!cancelRef.current) {
        setError(message);
        callbacksRef.current.onError?.(message);
      }
      throw err;
    } finally {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      stopDetection(true);
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      videoRef.current = null;
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [wsUrl, fps, confThreshold, startDetection, waitForConnection, captureFrame, blobToBase64, sendFrame, stopDetection]);

  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    videoRef.current?.pause();
    stopDetection(true);
    setIsProcessing(false);
  }, [stopDetection]);

  const reset = useCallback(async () => {
    cancelProcessing();
    resultsRef.current = [];
    completedFrameIndicesRef.current.clear();
    setCurrentFrame(0);
    setTotalFrames(0);
    setProgress(0);
    setError(null);
    setResults([]);
    if (sessionId) await clearSessionCache(sessionId);
  }, [cancelProcessing, sessionId, clearSessionCache]);

  const setConfThreshold = useCallback((value: number) => {
    const safeValue = Math.min(1, Math.max(0, value));
    setConfThresholdState(safeValue);
    setCoreConfThreshold(safeValue);
  }, [setCoreConfThreshold]);

  return {
    isProcessing,
    isConnected,
    currentFrame,
    totalFrames,
    framesSent,
    framesReceived,
    progress,
    error,
    results,
    confThreshold,
    processVideo,
    cancelProcessing,
    reset,
    setConfThreshold,
  };
}

export default useVideoFileDetection;
