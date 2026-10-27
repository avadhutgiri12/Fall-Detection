"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useFrameStreamDetection, type DetectionResult } from "./useFrameStreamDetection";
import { useVideoCache } from "./useVideoCache";

export type { DetectionResult };

export interface VideoFrame {
  index: number;
  blob: Blob;
  timestamp: number;
}

export interface UseVideoFileDetectionOptions {
  /** WebSocket URL for detection */
  wsUrl?: string;
  /** REST API URL for fallback */
  apiUrl?: string;
  /** Number of frames per second to process (default: 10) */
  fps?: number;
  /** Max resolution for inference (default: 640) */
  maxResolution?: number;
  /** Confidence threshold for detection (default: 0.6) */
  confThreshold?: number;
  /** Session ID for backend session tracking */
  sessionId?: string;
  /** Callback when a frame result is received */
  onFrameResult?: (result: DetectionResult) => void;
  /** Callback when a frame fails */
  onFrameError?: (frameIndex: number, error: Error) => void;
  /** Callback when a fall is detected */
  onFallDetected?: (score: number, frameIndex: number) => void;
  /** Callback for progress updates (0-1) */
  onProgress?: (progress: number) => void;
  /** Callback when processing completes */
  onComplete?: (results: DetectionResult[]) => void;
  /** Callback for errors */
  onError?: (error: string) => void;
}

export interface UseVideoFileDetectionReturn {
  // State
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

  // Controls
  processVideo: (videoFile: File) => Promise<DetectionResult[]>;
  cancelProcessing: () => void;
  reset: () => void;
  setConfThreshold: (value: number) => void;
}

export function useVideoFileDetection({
  wsUrl,
  apiUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000",
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
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [confThreshold, setConfThresholdState] = useState(initialConfThreshold);

  // Keep the latest WebSocket state accessible to long-running async callbacks.
  const isConnectedRef = useRef(false);

  const cancelRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef(0);
  const frameIndexRef = useRef(0);
  const videoFileRef = useRef<File | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cache for storing results
  const { saveChunk, updateSession, clearSessionCache } = useVideoCache();

  // Shared core detection hook
  const {
    isDetecting,
    isConnected,
    framesSent,
    framesReceived,
    sendFrame,
    startDetection,
    stopDetection,
    setConfThreshold: setCoreConfThreshold,
    confThreshold: coreConfThreshold,
  } = useFrameStreamDetection({
    wsUrl: wsUrl || "", // Will be validated in processVideo
    confThreshold: initialConfThreshold,
    onFrameResult: (result) => {
      // Store result
      setResults((prev) => [...prev, result]);
      onFrameResult?.(result);

      // Save to IndexedDB cache per frame (or batch per 10 frames)
      if (sessionId && result.frame_index >= 0) {
        saveChunk({
          sessionId,
          chunkIndex: Math.floor(result.frame_index / 10), // Group frames into chunks of 10
          frames: [{
            index: result.frame_index,
            blob: new Blob(), // We don't have the blob here, just storing results
            timestamp: result.timestamp,
          }],
          results: [{
            boxes: result.boxes,
            scores: result.scores,
            falls: result.falls,
            timestamp: result.timestamp,
          }],
        }).catch(console.error);
      }
    },
    onFrameError: (frameIndex, err) => {
      console.error(`[useVideoFileDetection] Frame ${frameIndex} error:`, err);
      onFrameError?.(frameIndex, err);
      // Continue processing - don't stop on single frame error
    },
    onFallDetected: (score, frameIndex) => {
      onFallDetected?.(score, frameIndex);
    },
  });

  // Sync values that are read by long-running async callbacks.
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    setConfThresholdState(coreConfThreshold);
  }, [coreConfThreshold]);

  const extractFramesFromVideo = useCallback(
    async (videoFile: File, startFrame: number, frameCount: number): Promise<VideoFrame[]> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoFile);
        video.src = url;

        const frames: VideoFrame[] = [];
        let extractedCount = 0;
        let frameDuration = 0;

        video.onloadedmetadata = () => {
          const duration = video.duration;
          const totalFrames = Math.floor(duration * 30); // Assume 30 FPS source
          frameDuration = duration / totalFrames;

          // Seek to start frame
          video.currentTime = startFrame * frameDuration;
        };

        video.onseeked = () => {
          if (cancelRef.current) {
            URL.revokeObjectURL(url);
            reject(new Error("Processing cancelled"));
            return;
          }

          if (extractedCount >= frameCount || video.currentTime >= video.duration) {
            URL.revokeObjectURL(url);
            resolve(frames);
            return;
          }

          // Create canvas for frame extraction
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Could not create canvas context"));
            return;
          }

          // Set canvas size (respecting max resolution)
          const scale = Math.min(maxResolution / video.videoWidth, maxResolution / video.videoHeight, 1);
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;

          // Draw frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                frames.push({
                  index: startFrame + extractedCount,
                  blob,
                  timestamp: video.currentTime,
                });
                extractedCount++;

                // Seek to next frame
                const nextTime = video.currentTime + frameDuration;
                if (nextTime < video.duration && extractedCount < frameCount) {
                  video.currentTime = nextTime;
                } else {
                  URL.revokeObjectURL(url);
                  resolve(frames);
                }
              } else {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to encode frame"));
              }
            },
            "image/jpeg",
            0.8
          );
        };

        video.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Video loading error"));
        };
      });
    },
    [maxResolution]
  );

  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read frame"));
      reader.readAsDataURL(blob);
    });
  }, []);

  const processVideo = useCallback(
    async (videoFile: File): Promise<DetectionResult[]> => {
      if (isProcessing) return [];

      // Validate wsUrl is provided
      if (!wsUrl) {
        const errorMsg = "WebSocket URL (wsUrl) is required for video file detection";
        setError(errorMsg);
        onError?.(errorMsg);
        return [];
      }

      cancelRef.current = false;
      setIsProcessing(true);
      setError(null);
      setCurrentFrame(0);
      setProgress(0);
      setResults([]);
      frameIndexRef.current = 0;
      videoFileRef.current = videoFile;

      // Create video element to get metadata
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const url = URL.createObjectURL(videoFile);
      video.src = url;
      videoElementRef.current = video;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });

      const duration = video.duration;
      const estimatedFPS = 30;
      const totalFramesCount = Math.floor(duration * estimatedFPS);
      setTotalFrames(totalFramesCount);

      URL.revokeObjectURL(url);

      // Start the WebSocket connection.
      startDetection(confThreshold);

      // Wait for the latest connection state, not the stale value captured
      // when processVideo was first called.
      try {
        await new Promise<void>((resolve, reject) => {
        let settled = false;
        let checkConnection: ReturnType<typeof setInterval> | undefined;
        let connectionTimeout: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
          if (checkConnection !== undefined) clearInterval(checkConnection);
          if (connectionTimeout !== undefined) clearTimeout(connectionTimeout);
        };

        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          cleanup();
          callback();
        };

        const check = () => {
          if (cancelRef.current) {
            finish(() => reject(new Error("Cancelled")));
            return;
          }

          if (isConnectedRef.current) {
            finish(resolve);
          }
        };

        checkConnection = setInterval(check, 100);
        connectionTimeout = setTimeout(() => {
          finish(() => reject(
            new Error(
              `Connection timeout: WebSocket did not become ready within 10 seconds. URL: ${wsUrl}`
            )
          ));
        }, 10000);

        // Check immediately in case the socket opened before the interval ran.
        check();
        });
      } catch (connectionError) {
        const message = connectionError instanceof Error
          ? connectionError.message
          : "Unable to connect to the detection WebSocket.";

        setError(message);
        onError?.(message);
        stopDetection();
        setIsProcessing(false);
        URL.revokeObjectURL(url);
        return [];
      }

      if (cancelRef.current) {
        setIsProcessing(false);
        return [];
      }

      // Extract all frames upfront (or in batches)
      // For memory efficiency, we'll extract in batches of 100 frames
      const batchSize = 100;
      const allFrames: VideoFrame[] = [];

      for (let batchStart = 0; batchStart < totalFramesCount; batchStart += batchSize) {
        if (cancelRef.current) break;

        const framesToExtract = Math.min(batchSize, totalFramesCount - batchStart);
        try {
          const frames = await extractFramesFromVideo(videoFile, batchStart, framesToExtract);
          allFrames.push(...frames);
        } catch (err) {
          console.error(`[useVideoFileDetection] Batch ${batchStart} extraction error:`, err);
          if (!cancelRef.current) {
            const errorMsg = err instanceof Error ? err.message : "Frame extraction failed";
            setError(errorMsg);
            onError?.(errorMsg);
          }
          break;
        }
      }

      if (cancelRef.current || allFrames.length === 0) {
        setIsProcessing(false);
        stopDetection();
        return [];
      }

      // Send frames at controlled FPS
      const frameInterval = 1000 / fps; // ms between frames
      let frameIndex = 0;

      const sendNextFrame = async () => {
        if (cancelRef.current || frameIndex >= allFrames.length) {
          // All frames sent, wait for remaining responses
          await new Promise<void>((resolve) => {
            const checkDone = setInterval(() => {
              if (framesReceived >= frameIndex || cancelRef.current) {
                clearInterval(checkDone);
                resolve();
              }
            }, 100);
            // Max wait 30 seconds for remaining responses
            setTimeout(() => {
              clearInterval(checkDone);
              resolve();
            }, 30000);
          });
          return;
        }

        const frame = allFrames[frameIndex];
        const now = performance.now();

        // Throttle to target FPS
        if (now - lastCaptureTimeRef.current < frameInterval) {
          animationRef.current = requestAnimationFrame(sendNextFrame);
          return;
        }
        lastCaptureTimeRef.current = now;

        try {
          // Convert frame to base64
          const base64 = await blobToBase64(frame.blob);

          // Send frame
          sendFrame(base64, frame.index, frame.timestamp);
          frameIndex++;
          setCurrentFrame(frameIndex);
          setProgress(frameIndex / totalFramesCount);
          onProgress?.(frameIndex / totalFramesCount);
        } catch (err) {
          console.error(`[useVideoFileDetection] Frame ${frameIndex} send error:`, err);
          frameIndex++; // Skip failed frame
        }

        // Schedule next frame
        if (!cancelRef.current) {
          animationRef.current = requestAnimationFrame(sendNextFrame);
        }
      };

      // Start the sending loop
      animationRef.current = requestAnimationFrame(sendNextFrame);

      // Wait for completion (when all frames sent and received)
      await new Promise<void>((resolve) => {
        const checkComplete = setInterval(() => {
          if (cancelRef.current || (frameIndex >= allFrames.length && framesReceived >= frameIndex)) {
            clearInterval(checkComplete);
            resolve();
          }
        }, 100);
      });

      stopDetection();
      setIsProcessing(false);
      setProgress(1);

      if (!cancelRef.current) {
        onComplete?.(results);
      }

      return results;
    },
    [
      isProcessing,
      fps,
      confThreshold,
      extractFramesFromVideo,
      blobToBase64,
      startDetection,
      stopDetection,
      sendFrame,
      isConnected,
      framesReceived,
      onFrameResult,
      onFrameError,
      onFallDetected,
      onProgress,
      onComplete,
      onError,
      results,
    ]
  );

  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    stopDetection();
    setIsProcessing(false);
  }, [stopDetection]);

  const reset = useCallback(async () => {
    cancelRef.current = true;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    stopDetection();
    if (sessionId) {
      await clearSessionCache(sessionId);
    }
    setIsProcessing(false);
    setCurrentFrame(0);
    setTotalFrames(0);
    setProgress(0);
    setError(null);
    setResults([]);
    frameIndexRef.current = 0;
  }, [stopDetection, sessionId, clearSessionCache]);

  const setConfThreshold = useCallback((value: number) => {
    setConfThresholdState(value);
    setCoreConfThreshold(value);
  }, [setCoreConfThreshold]);

  return {
    // State
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

    // Controls
    processVideo,
    cancelProcessing,
    reset,
    setConfThreshold,
  };
}

export default useVideoFileDetection;