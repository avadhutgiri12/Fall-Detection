"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface DetectionResult {
  boxes: number[][];
  scores: number[];
  falls: boolean[];
  /** Unix timestamp in seconds. */
  timestamp: number;
}

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
  // Refs for mutable values that don't trigger re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const connectWebSocketRef = useRef<() => void>(() => {});
  const animationRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFallAlertRef = useRef(0);
  const isDetectingRef = useRef(false);
  const framePendingRef = useRef(false);
  const lastCaptureTimeRef = useRef(0);
  const confThresholdRef = useRef(0.6);
  const mountedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // React state for UI updates
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [lastReceived, setLastReceived] = useState<number | null>(null);
  const [wsStatus, setWsStatus] = useState<"CLOSED" | "CONNECTING" | "OPEN" | "CLOSING">("CLOSED");
  const [confThreshold, setConfThresholdState] = useState(0.6);

  // Keep the latest threshold available to the animation loop without stale closures.
  useEffect(() => {
    confThresholdRef.current = confThreshold;
  }, [confThreshold]);

  const closeWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      // Detach handlers so an intentional close cannot trigger reconnection.
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }

    if (mountedRef.current) {
      setIsConnected(false);
      setWsStatus("CLOSED");
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!isDetectingRef.current) return;

    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error("[useFallDetection] Could not create WebSocket:", err);
      if (mountedRef.current) setError("Could not connect to the detection server. Check the WebSocket URL and backend.");
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isDetectingRef.current) connectWebSocketRef.current();
      }, 1500);
      return;
    }

    wsRef.current = ws;
    if (mountedRef.current) setWsStatus("CONNECTING");

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      console.info("[useFallDetection] WebSocket connected:", wsUrl);
      if (mountedRef.current) {
        setIsConnected(true);
        setWsStatus("OPEN");
        setError(null);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (wsRef.current !== ws) return;
      try {
        const data = JSON.parse(String(event.data));
        if (data?.error) {
          console.error("[useFallDetection] Backend error:", data.error);
          if (mountedRef.current) setError(String(data.error));
          return;
        }

        const boxes = Array.isArray(data?.boxes) ? data.boxes : [];
        const scores = Array.isArray(data?.scores) ? data.scores : [];
        const falls = Array.isArray(data?.falls) ? data.falls.map(Boolean) : [];
        // Accept either Unix seconds or milliseconds from the backend.
        const rawTimestamp = data?.timestamp == null ? Number.NaN : Number(data.timestamp);
        const timestamp = Number.isFinite(rawTimestamp)
          ? (rawTimestamp > 1e12 ? rawTimestamp / 1000 : rawTimestamp)
          : Date.now() / 1000;

        const result: DetectionResult = { boxes, scores, falls, timestamp };
        if (mountedRef.current) {
          setDetections(result);
          setLastReceived(Date.now());
        }

        const fallIndex = result.falls.findIndex(Boolean);
        if (fallIndex !== -1 && onFallDetected) {
          const now = Date.now();
          if (now - lastFallAlertRef.current >= 2000) {
            lastFallAlertRef.current = now;
            onFallDetected(Number(result.scores[fallIndex]) || 0);
          }
        }
      } catch (err) {
        console.error("[useFallDetection] Failed to parse backend message:", err, event.data);
        if (mountedRef.current) setError("Received an invalid response from the detection server. Check backend response format.");
      }
    };

    ws.onerror = (event) => {
      console.error("[useFallDetection] WebSocket error:", event);
      if (mountedRef.current) setError("WebSocket connection error. Check that FastAPI is running and the URL is correct.");
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (mountedRef.current) {
        setIsConnected(false);
        setWsStatus("CLOSED");
      }
      console.warn("[useFallDetection] WebSocket closed:", event.code, event.reason || "no reason provided");

      // Reconnect while detection is active. The frame loop continues while connecting.
      if (isDetectingRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isDetectingRef.current) connectWebSocketRef.current();
        }, 1000);
      }
    };
  }, [wsUrl, onFallDetected]);

  // Keep reconnect callbacks pointed at the latest WebSocket handler.
  connectWebSocketRef.current = connectWebSocket;

  const captureFrame = useCallback(() => {
    if (!isDetectingRef.current) {
      animationRef.current = null;
      return;
    }

    const currentVideo = videoRef.current;
    const canvas = canvasRef.current;
    // Always schedule the next tick while detection is active, even when the
    // video/WebSocket is temporarily unavailable.
    animationRef.current = requestAnimationFrame(captureFrame);

    if (!currentVideo || !canvas || currentVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!currentVideo.videoWidth || !currentVideo.videoHeight) return;

    if (canvas.width !== currentVideo.videoWidth || canvas.height !== currentVideo.videoHeight) {
      canvas.width = currentVideo.videoWidth;
      canvas.height = currentVideo.videoHeight;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Limit traffic to about 10 frames/second and allow only one async encode/send at a time.
    const now = performance.now();
    if (now - lastCaptureTimeRef.current < 100 || framePendingRef.current) return;
    lastCaptureTimeRef.current = now;

    const context = canvas.getContext("2d");
    if (!context) {
      if (mountedRef.current) setError("Could not create a canvas context to capture camera frames.");
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
        if (!isDetectingRef.current || typeof reader.result !== "string") return;

        // Re-read the current socket after async encoding; it may have closed/reconnected.
        const activeSocket = wsRef.current;
        if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;

        try {
          // Sends a data URL: data:image/jpeg;base64,...
          // The FastAPI endpoint must accept JSON keys `image` and `conf_threshold`.
          const payload = {
            image: reader.result,
            conf_threshold: confThresholdRef.current,
          };
          activeSocket.send(JSON.stringify(payload));
          if (mountedRef.current) {
            setFrameCount((count) => count + 1);
            setLastSent(Date.now());
          }
        } catch (err) {
          console.error("[useFallDetection] Failed to send frame:", err);
          if (mountedRef.current) setError("Failed to send a frame to the detection server.");
        }
      };
      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.8);
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement, confThreshold?: number) => {
    if (!video) {
      setError("No video element provided.");
      return;
    }
    if (isDetectingRef.current) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      setError("The camera is still starting. Wait for the video preview, then start detection again.");
      return;
    }

    setError(null);
    setDetections(null);
    setFrameCount(0);
    setLastSent(null);
    setLastReceived(null);
    framePendingRef.current = false;
    lastCaptureTimeRef.current = 0;

    // Update confThreshold if provided
    if (confThreshold !== undefined) {
      setConfThresholdState(confThreshold);
      confThresholdRef.current = confThreshold;
    }

    // Store video reference for capture loop
    videoRef.current = video;

    // IMPORTANT: set the ref synchronously before calling captureFrame.
    // React state updates/effects do not run synchronously, so relying on the effect here
    // can cause the first capture callback to exit before the loop is scheduled.
    isDetectingRef.current = true;
    setIsDetecting(true);

    // Create offscreen canvas for frame capture
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;

    connectWebSocket();

    captureFrame();
  }, [connectWebSocket, captureFrame]);

  const stopDetection = useCallback(() => {
    // Flip the ref first so no pending callback schedules another frame.
    isDetectingRef.current = false;

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    framePendingRef.current = false;
    closeWebSocket();
    if (mountedRef.current) {
      setDetections(null);
      setFrameCount(0);
      setLastSent(null);
      setLastReceived(null);
      setIsDetecting(false);
    }
  }, [closeWebSocket]);

  const setConfThreshold = useCallback((value: number) => {
    setConfThresholdState(value);
    confThresholdRef.current = value;
  }, []);

  // Track mount state and release browser resources on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isDetectingRef.current = false;
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close();
      }
    };
  }, []);

  return {
    // State
    isDetecting,
    isConnected,
    detections,
    error,
    frameCount,
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