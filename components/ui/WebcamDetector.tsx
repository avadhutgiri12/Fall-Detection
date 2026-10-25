"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { Input } from "./Input";
import { Label } from "./Input";

interface DetectionResult {
  boxes: number[][];
  scores: number[];
  falls: boolean[];
  /** Unix timestamp in seconds. */
  timestamp: number;
}

interface WebcamDetectorProps {
  /** WebSocket endpoint that accepts JSON { image, conf_threshold }. */
  wsUrl?: string;
  /** REST API base URL for config. */
  apiUrl?: string;
  /** Initial confidence threshold. */
  initialConfThreshold?: number;
  /** Callback when a fall is detected. */
  onFallDetected?: (score: number) => void;
}

export function WebcamDetector({
  wsUrl = "ws://localhost:8000/ws/detect",
  apiUrl = "http://localhost:8000",
  initialConfThreshold = 0.6,
  onFallDetected,
}: WebcamDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const connectWebSocketRef = useRef<() => void>(() => {});
  const animationRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFallAlertRef = useRef(0);
  const isDetectingRef = useRef(false);
  const framePendingRef = useRef(false);
  const lastCaptureTimeRef = useRef(0);
  const confThresholdRef = useRef(initialConfThreshold);
  const mountedRef = useRef(false);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [confThreshold, setConfThreshold] = useState(initialConfThreshold);
  const [detections, setDetections] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [showSettings, setShowSettings] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [lastReceived, setLastReceived] = useState<number | null>(null);
  const [wsStatus, setWsStatus] = useState<"CLOSED" | "CONNECTING" | "OPEN" | "CLOSING">("CLOSED");

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
      console.error("[WebcamDetector] Could not create WebSocket:", err);
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
      console.info("[WebcamDetector] WebSocket connected:", wsUrl);
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
          console.error("[WebcamDetector] Backend error:", data.error);
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
        console.error("[WebcamDetector] Failed to parse backend message:", err, event.data);
        if (mountedRef.current) setError("Received an invalid response from the detection server. Check backend response format.");
      }
    };

    ws.onerror = (event) => {
      console.error("[WebcamDetector] WebSocket error:", event);
      if (mountedRef.current) setError("WebSocket connection error. Check that FastAPI is running and the URL is correct.");
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (mountedRef.current) {
        setIsConnected(false);
        setWsStatus("CLOSED");
      }
      console.warn("[WebcamDetector] WebSocket closed:", event.code, event.reason || "no reason provided");

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
      console.error("[WebcamDetector] Camera error:", err);
      setIsCameraOn(false);
      setError(err instanceof Error ? err.message : "Failed to access camera. Please allow camera permissions.");
    }
  }, [facingMode]);

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

  const stopCamera = useCallback(() => {
    if (isDetectingRef.current) stopDetection();

    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    if (mountedRef.current) setIsCameraOn(false);
  }, [stopDetection]);

  const startDetection = useCallback(() => {
    const video = videoRef.current;
    if (!isCameraOn || !video) {
      setError("Start the camera before starting detection.");
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

    // IMPORTANT: set the ref synchronously before calling captureFrame.
    // React state updates/effects do not run synchronously, so relying on the effect here
    // can cause the first capture callback to exit before the loop is scheduled.
    isDetectingRef.current = true;
    setIsDetecting(true);

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;

    connectWebSocket();

    const captureFrame = () => {
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
        setError("Could not create a canvas context to capture camera frames.");
        return;
      }

      try {
        context.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        console.error("[WebcamDetector] Could not draw video frame:", err);
        return;
      }

      framePendingRef.current = true;
      canvas.toBlob((blob) => {
        if (!blob) {
          framePendingRef.current = false;
          console.error("[WebcamDetector] Browser failed to encode a JPEG frame.");
          return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
          framePendingRef.current = false;
          console.error("[WebcamDetector] Failed to read encoded frame.");
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
            console.error("[WebcamDetector] Failed to send frame:", err);
            if (mountedRef.current) setError("Failed to send a frame to the detection server.");
          }
        };
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.8);
    };

    captureFrame();
  }, [isCameraOn, connectWebSocket]);

  const toggleCamera = useCallback(async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    const wasOn = isCameraOn;

    if (isDetectingRef.current) stopDetection();
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
  }, [facingMode, isCameraOn, startCamera, stopDetection]);

  // Click handler wrappers for onClick events (ignore MouseEvent parameter)
  const handleStartCameraClick = useCallback(() => {
    void startCamera();
  }, [startCamera]);

  const handleStopCameraClick = useCallback(() => {
    void stopCamera();
  }, [stopCamera]);

  const handleStartDetectionClick = useCallback(() => {
    void startDetection();
  }, [startDetection]);

  const handleStopDetectionClick = useCallback(() => {
    void stopDetection();
  }, [stopDetection]);

  const handleToggleCameraClick = useCallback(() => {
    void toggleCamera();
  }, [toggleCamera]);

  const handleConfChange = useCallback((value: number) => {
    setConfThreshold(value);
    confThresholdRef.current = value;
  }, []);

  // Fetch optional backend config. A threshold of 0 is valid, so don't use `||` here.
  useEffect(() => {
    let cancelled = false;
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/config`);
        if (!response.ok) return;
        const data = await response.json();
        const threshold = Number(data?.conf_threshold);
        if (!cancelled && Number.isFinite(threshold) && threshold >= 0 && threshold <= 1) {
          setConfThreshold(threshold);
          confThresholdRef.current = threshold;
        }
      } catch {
        // Config is optional; the WebSocket detection path can still work.
      }
    };
    void fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, initialConfThreshold]);

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

      const video = videoRef.current;
      if (video?.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    };
  }, []);

  // Draw detections on overlay canvas
  useEffect(() => {
    if (!overlayRef.current || !detections || !videoRef.current) return;

    const overlay = overlayRef.current;
    const video = videoRef.current;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    // Get the video element's DISPLAY dimensions (CSS layout size)
    // This accounts for object-cover scaling
    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    // Get the video's INTRINSIC dimensions (actual video resolution)
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!displayWidth || !displayHeight || !videoWidth || !videoHeight) return;

    // Resize overlay canvas to match the DISPLAY size (CSS pixels)
    overlay.width = displayWidth;
    overlay.height = displayHeight;

    // Calculate scale factors from video space to display space
    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw detection boxes (scale coordinates from video space to display space)
    detections.boxes.forEach((box, i) => {
      const [x1, y1, x2, y2] = box;
      const score = detections.scores[i];
      const isFall = detections.falls[i];

      // Scale coordinates from video space to display space
      const sx1 = x1 * scaleX;
      const sy1 = y1 * scaleY;
      const sx2 = x2 * scaleX;
      const sy2 = y2 * scaleY;

      const color = isFall ? "#ef4444" : "#f97316"; // Red for fall, Orange for normal
      const label = isFall ? `FALL ${(score * 100).toFixed(0)}%` : `${(score * 100).toFixed(0)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1);

      // Label background
      ctx.fillStyle = color;
      const textWidth = ctx.measureText(label).width + 10;
      ctx.fillRect(sx1, sy1 - 24, textWidth, 24);

      // Label text
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(label, sx1 + 5, sy1 - 6);
    });
  }, [detections]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-0 overflow-hidden">
        {/* Video Container */}
        <div className="relative aspect-video bg-gray-900">
          {/* Video Element */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            aria-hidden="true"
          />

          {/* Overlay Canvas for Detections */}
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          />

          {/* Status Overlay */}
          <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-2 justify-between">
            <div className="flex items-center gap-2">
              {/* Camera Status */}
              <span
                className={`w-3 h-3 rounded-full ${
                  isCameraOn ? "bg-green-500" : "bg-gray-500"
                }`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-white bg-black/50 px-2 py-1 rounded">
                {isCameraOn ? "Camera On" : "Camera Off"}
              </span>
              {/* Detection Status */}
              {isCameraOn && (
                <span
                  className={`w-3 h-3 rounded-full ${
                    isDetecting ? "bg-green-500" : "bg-yellow-500"
                  }`}
                  aria-hidden="true"
                />
              )}
              {isCameraOn && (
                <span className="text-sm font-medium text-white bg-black/50 px-2 py-1 rounded">
                  {isDetecting ? "Detecting" : "Idle"}
                </span>
              )}
              {isDetecting && (
                <span className="text-sm font-medium text-red-400 bg-black/50 px-2 py-1 rounded flex items-center gap-1 animate-pulse">
                  ● LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {detections && detections.boxes.length > 0 && (
                <span className="text-sm text-white bg-black/50 px-2 py-1 rounded">
                  {detections.boxes.length} person{detections.boxes.length !== 1 ? "s" : ""} detected
                </span>
              )}
              {detections && detections.falls.some((f) => f) && (
                <span className="text-sm font-bold text-red-300 bg-red-900/80 px-3 py-1 rounded animate-pulse">
                  ⚠ FALL DETECTED
                </span>
              )}
            </div>
          </div>

          {/* Camera Switch Button */}
          <button
            onClick={toggleCamera}
            disabled={!isCameraOn}
            className="absolute bottom-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Switch camera"
            title="Switch camera"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          {/* Placeholder when camera is off */}
          {!isCameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Live Fall Detection</h3>
              <p className="text-gray-400 max-w-md mx-auto mb-6">
                Click "Start Camera" to activate your webcam. Then click "Start Detection" to begin real-time fall detection using AI.
              </p>
              <Button variant="fancy" size="lg" onClick={handleStartCameraClick} disabled={isCameraOn}>
                Start Camera
              </Button>
            </div>
          )}

          {/* Camera On but Detection Off - Show preview */}
          {isCameraOn && !isDetecting && (
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-white/80 bg-black/50 px-3 py-1 rounded-lg text-sm inline-block">
                Camera active. Click "Start Detection" to begin AI analysis.
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 text-red-100 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div className="p-6 border-t border-border bg-gray-50 dark:bg-gray-900/50">
          {/* Camera Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant={isCameraOn ? "secondary" : "fancy"}
                size="lg"
                onClick={isCameraOn ? stopCamera : startCamera}
                className="min-w-[140px]"
              >
                {isCameraOn ? "Stop Camera" : "Start Camera"}
              </Button>

              <Button variant="outline" size="lg" onClick={toggleCamera} disabled={!isCameraOn}>
                Switch Camera
              </Button>
            </div>

            {/* Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="ml-auto"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </Button>
          </div>

          {/* Detection Controls */}
          {isCameraOn && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium text-foreground">Detection:</span>
                <Button
                  variant={isDetecting ? "secondary" : "fancy"}
                  size="lg"
                  onClick={isDetecting ? stopDetection : startDetection}
                  disabled={!isCameraOn}
                  className="min-w-[160px]"
                >
                  {isDetecting ? "Stop Detection" : "Start Detection"}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-mono ${isDetecting ? "text-green-600" : "text-muted-foreground"}`}>
                  {isDetecting ? "Running" : "Stopped"}
                </span>
                {isConnected && (
                  <span className="text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded">WS Connected</span>
                )}
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <Label htmlFor="conf-threshold" className="block text-sm font-medium mb-2">
                  Confidence Threshold: {confThreshold.toFixed(2)}
                </Label>
                <Input
                  id="conf-threshold"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={confThreshold}
                  onChange={(e) => handleConfChange(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower = more sensitive (more false positives). Higher = fewer detections.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="font-medium text-foreground">Model</div>
                  <div className="text-muted-foreground">YOLOv8n-pose</div>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="font-medium text-foreground">Backend</div>
                  <div className="text-muted-foreground">FastAPI + WebSocket</div>
                </div>
              </div>
            </div>
          )}

          {/* Detection Info */}
          {detections && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-foreground mb-2">Latest Detection</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Persons Detected</div>
                <div className="font-mono text-foreground">{detections.boxes.length}</div>
                <div className="text-muted-foreground">Falls Detected</div>
                <div className="font-mono text-red-600">
                  {detections.falls.filter((f) => f).length}
                </div>
                <div className="text-muted-foreground">Max Confidence</div>
                <div className="font-mono text-foreground">
                  {detections.scores.length > 0
                    ? (Math.max(...detections.scores) * 100).toFixed(1) + "%"
                    : "N/A"}
                </div>
                <div className="text-muted-foreground">Timestamp</div>
                <div className="font-mono text-foreground">
                  {new Date(detections.timestamp * 1000).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}

          {/* Debug Info */}
          {(isCameraOn || isDetecting) && (
            <div className="pt-4 border-t border-border bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                Debug Info
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">Camera</div>
                <div className="font-mono text-foreground">{isCameraOn ? "On" : "Off"}</div>
                <div className="text-muted-foreground">Detection</div>
                <div className="font-mono text-foreground">{isDetecting ? "Running" : "Stopped"}</div>
                <div className="text-muted-foreground">Frames Sent</div>
                <div className="font-mono text-foreground">{frameCount}</div>
                <div className="text-muted-foreground">WS Status</div>
                <div className="font-mono text-foreground">
                  {wsStatus}
                </div>
                <div className="text-muted-foreground">Last Sent</div>
                <div className="font-mono text-foreground">
                  {lastSent ? `${((Date.now() - lastSent) / 1000).toFixed(1)}s ago` : "Never"}
                </div>
                <div className="text-muted-foreground">Last Received</div>
                <div className="font-mono text-foreground">
                  {lastReceived ? `${((Date.now() - lastReceived) / 1000).toFixed(1)}s ago` : "Never"}
                </div>
                <div className="text-muted-foreground">Capture Canvas</div>
                <div className="font-mono text-foreground">
                  {canvasRef.current ? `${canvasRef.current.width}×${canvasRef.current.height}` : "N/A"}
                </div>
                <div className="text-muted-foreground">Video Size</div>
                <div className="font-mono text-foreground">
                  {videoRef.current ? `${videoRef.current.videoWidth}×${videoRef.current.videoHeight}` : "N/A"}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default WebcamDetector;