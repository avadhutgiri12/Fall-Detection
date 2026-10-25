"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface UseCameraOptions {
  /** Initial facing mode ("user" for front, "environment" for back) */
  initialFacingMode?: "user" | "environment";
}

export interface UseCameraReturn {
  /** Ref to attach to the video element */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Whether the camera stream is active */
  isCameraOn: boolean;
  /** Current facing mode */
  facingMode: "user" | "environment";
  /** Error message if any */
  error: string | null;
  /** Start the camera stream */
  startCamera: (mode?: "user" | "environment") => Promise<void>;
  /** Stop the camera stream */
  stopCamera: () => void;
  /** Toggle between front/back camera */
  toggleCamera: () => Promise<void>;
}

export function useCamera({
  initialFacingMode = "user",
}: UseCameraOptions = {}): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(initialFacingMode);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (mode?: "user" | "environment") => {
    const effectiveMode = mode ?? facingMode;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser. Use HTTPS or localhost and allow camera permissions.");
      return;
    }

    try {
      // Release an existing stream before opening another one.
      const existingStream = videoRef.current?.srcObject;
      if (existingStream instanceof MediaStream) {
        existingStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: effectiveMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = stream;
      await video.play();
      setFacingMode(effectiveMode);
      setIsCameraOn(true);
    } catch (err) {
      console.error("[useCamera] Camera error:", err);
      setIsCameraOn(false);
      setError(err instanceof Error ? err.message : "Failed to access camera. Please allow camera permissions.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    const wasOn = isCameraOn;

    // Stop current stream
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setFacingMode(newMode);

    if (wasOn) {
      // Pass the new mode directly; state updates are asynchronous.
      window.setTimeout(() => {
        void startCamera(newMode);
      }, 250);
    }
  }, [facingMode, isCameraOn, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video?.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    };
  }, []);

  return {
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    isCameraOn,
    facingMode,
    error,
    startCamera,
    stopCamera,
    toggleCamera,
  };
}

export default useCamera;