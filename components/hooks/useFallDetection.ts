"use client";

import { useRef, useCallback } from "react";
import { useFrameStreamDetection, type DetectionResult } from "./useFrameStreamDetection";

export interface UseFallDetectionOptions {
  /** WebSocket endpoint that accepts JSON { image, conf_threshold }. */
  wsUrl: string;
  /** Callback when a fall is detected. */
  onFallDetected?: (score: number) => void;
}

export interface UseFallDetectionReturn {
  // State
  isDetecting: boolean;
  isConnected: boolean;
  detections: DetectionResult | null;
  error: string | null;
  frameCount: number;
  lastSent: number | null;
  lastReceived: number | null;
  wsStatus: "CLOSED" | "CONNECTING" | "OPEN" | "CLOSING";
  confThreshold: number;

  // Controls
  startDetection: (video: HTMLVideoElement, confThreshold?: number) => void;
  stopDetection: () => void;
  setConfThreshold: (value: number) => void;
}

export function useFallDetection({
  wsUrl,
  onFallDetected,
}: UseFallDetectionOptions): UseFallDetectionReturn {
  // Use the shared core for WebSocket management
  const {
    isDetecting,
    isConnected,
    detections,
    error,
    framesSent,
    framesReceived,
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
      ? (score, frameIndex) => onFallDetected(score)
      : undefined,
    confThreshold: 0.6,
  });

  // Refs for video/canvas (webcam-specific)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef(0);
  const framePendingRef = useRef(false);

  // Frame capture loop (webcam-specific)
  const captureFrame = useCallback(() => {
    if (!isDetecting) {
      animationRef.current = null;
      return;
    }

    const currentVideo = videoRef.current;
    const canvas = canvasRef.current;
    // Always schedule the next tick while detection is active
    animationRef.current = requestAnimationFrame(captureFrame);

    if (!currentVideo || !canvas || currentVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!currentVideo.videoWidth || !currentVideo.videoHeight) return;

    if (canvas.width !== currentVideo.videoWidth || canvas.height !== currentVideo.videoHeight) {
      canvas.width = currentVideo.videoWidth;
      canvas.height = currentVideo.videoHeight;
    }

    // Limit traffic to about 10 frames/second and allow only one async encode/send at a time.
    const now = performance.now();
    if (now - lastCaptureTimeRef.current < 100 || framePendingRef.current) return;
    lastCaptureTimeRef.current = now;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    try {
      context.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.error("[useFallDetection] Could not draw video frame:", err);
      return;
    }

    framePendingRef.current = true;
    canvas.toBlob((blob) => {
      if (!blob) {
        framePendingRef.current = false;
        console.error("[useFallDetection] Browser failed to encode a JPEG frame.");
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        framePendingRef.current = false;
        console.error("[useFallDetection] Failed to read encoded frame.");
      };
      reader.onload = () => {
        framePendingRef.current = false;
        if (!isDetecting || typeof reader.result !== "string") return;

        // Send frame via shared core
        // Use frameCount as frame_index for ordering
        sendFrame(reader.result, framesSent, Date.now() / 1000);
      };
      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.8);
  }, [isDetecting, framesSent, sendFrame]);

  const startDetection = useCallback((video: HTMLVideoElement, confThreshold?: number) => {
    if (!video) {
      return;
    }
    if (isDetecting) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return;
    }

    // Store video reference for capture loop
    videoRef.current = video;

    // Create offscreen canvas for frame capture
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;

    coreStartDetection(confThreshold);
    captureFrame();
  }, [isDetecting, coreStartDetection, captureFrame]);

  const stopDetection = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    framePendingRef.current = false;
    coreStopDetection();
  }, [coreStopDetection]);

  const setConfThreshold = useCallback((value: number) => {
    coreSetConfThreshold(value);
  }, [coreSetConfThreshold]);

  return {
    // State
    isDetecting,
    isConnected,
    detections,
    error,
    frameCount: framesSent,
    lastSent,
    lastReceived,
    wsStatus,
    confThreshold,

    // Controls
    startDetection,
    stopDetection,
    setConfThreshold,
  };
}

export default useFallDetection;