"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useFrameStreamDetection,
  type DetectionResult,
} from "./useFrameStreamDetection";

export interface UseFallDetectionOptions {
  wsUrl: string;
  onFallDetected?: (score: number, frameIndex: number, emailSent: boolean) => void;
}

export interface UseFallDetectionReturn {
  isDetecting: boolean;
  isConnected: boolean;
  detections: DetectionResult | null;
  error: string | null;
  frameCount: number;
  lastSent: number | null;
  lastReceived: number | null;
  wsStatus: "CLOSED" | "CONNECTING" | "OPEN" | "CLOSING";
  confThreshold: number;
  startDetection: (video: HTMLVideoElement, confThreshold?: number) => void;
  stopDetection: () => void;
  setConfThreshold: (value: number) => void;
}

export function useFallDetection({
  wsUrl,
  onFallDetected,
}: UseFallDetectionOptions): UseFallDetectionReturn {
  const {
    isDetecting,
    isConnected,
    detections,
    error,
    framesSent,
    lastSent,
    lastReceived,
    wsStatus,
    confThreshold,
    startDetection: coreStartDetection,
    stopDetection: coreStopDetection,
    setConfThreshold: coreSetConfThreshold,
    sendFrame,
  } = useFrameStreamDetection({
    wsUrl,
    onFallDetected: onFallDetected
      ? (score: number, frameIndex: number, emailSent: boolean) => onFallDetected(score, frameIndex, emailSent)
      : undefined,
    confThreshold: 0.6,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // These refs are intentionally used inside requestAnimationFrame callbacks:
  // React state updates are asynchronous and can otherwise leave stale values.
  const runningRef = useRef(false);
  const connectedRef = useRef(false);
  const frameIndexRef = useRef(0);
  const lastCaptureTimeRef = useRef(0);
  const encodingRef = useRef(false);
  const captureFrameRef = useRef<() => void>(() => {});

  useEffect(() => {
    connectedRef.current = isConnected;
  }, [isConnected]);

  const captureFrame = useCallback(() => {
    if (!runningRef.current) {
      animationRef.current = null;
      return;
    }

    // Keep the loop alive while the WebSocket is connecting or reconnecting.
    animationRef.current = requestAnimationFrame(() => captureFrameRef.current());

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!video.videoWidth || !video.videoHeight) return;
    if (!connectedRef.current || encodingRef.current) return;

    const now = performance.now();
    if (now - lastCaptureTimeRef.current < 100) return; // about 10 FPS
    lastCaptureTimeRef.current = now;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) return;

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.error("[useFallDetection] Could not draw video frame:", err);
      return;
    }

    encodingRef.current = true;

    canvas.toBlob((blob) => {
      if (!blob) {
        encodingRef.current = false;
        console.error("[useFallDetection] Browser failed to encode a JPEG frame.");
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        encodingRef.current = false;
        console.error("[useFallDetection] Failed to read encoded frame.");
      };

      reader.onload = () => {
        encodingRef.current = false;

        if (!runningRef.current || typeof reader.result !== "string") return;
        if (!connectedRef.current) return;

        const frameIndex = frameIndexRef.current;
        const sent = sendFrame(reader.result, frameIndex, Date.now() / 1000);

        // sendFrame returns true only if ws.send() actually succeeded.
        // If the previous response is still pending, a later frame retries.
        if (sent) {
          frameIndexRef.current += 1;
        } else {
          console.debug("[useFallDetection] Frame was not sent; retrying on a later frame.");
        }
      };

      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.8);
  }, [sendFrame]);

  useEffect(() => {
    captureFrameRef.current = captureFrame;
  }, [captureFrame]);

  const startDetection = useCallback(
    (video: HTMLVideoElement, nextThreshold?: number) => {
      if (!video) {
        console.error("[useFallDetection] Cannot start: video element is missing.");
        return;
      }
      if (runningRef.current) return;

      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        console.error("[useFallDetection] Camera video is not ready.", {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
        return;
      }

      videoRef.current = video;
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;

      frameIndexRef.current = 0;
      lastCaptureTimeRef.current = 0;
      encodingRef.current = false;
      runningRef.current = true;

      // This opens the WebSocket. Frame capture waits until isConnected is true.
      coreStartDetection(nextThreshold);

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(() => captureFrameRef.current());

      console.info("[useFallDetection] Detection started; waiting for WebSocket.");
    },
    [coreStartDetection]
  );

  const stopDetection = useCallback(() => {
    runningRef.current = false;
    connectedRef.current = false;
    encodingRef.current = false;

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    coreStopDetection();
    console.info("[useFallDetection] Detection stopped.");
  }, [coreStopDetection]);

  const setConfThreshold = useCallback(
    (value: number) => coreSetConfThreshold(value),
    [coreSetConfThreshold]
  );

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    isDetecting,
    isConnected,
    detections,
    error,
    frameCount: framesSent,
    lastSent,
    lastReceived,
    wsStatus,
    confThreshold,
    startDetection,
    stopDetection,
    setConfThreshold,
  };
}

export default useFallDetection;
