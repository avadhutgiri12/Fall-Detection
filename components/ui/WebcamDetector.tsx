"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CanvasButton } from "./CanvasButton";
import { Card, CardContent } from "./Card";
import { Input, Label } from "./Input";
import { useFallDetection } from "../hooks/useFallDetection";
import { useCamera } from "../hooks/useCamera";
import { useToast } from "./ToastProvider";
import { useErrorTracker } from "../hooks/useErrorTracker";
import { ErrorChecker } from "./ErrorChecker";

export interface WebcamDetectorProps {
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
  wsUrl = typeof window !== "undefined"
    ? `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/detect`
    : "ws://localhost:8000/ws/detect",
  apiUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000",
  initialConfThreshold = 0.6,
}: WebcamDetectorProps) {
  // Generate session ID on mount
  const [sessionId] = useState(() => {
    if (typeof window !== "undefined") {
      // Try to get existing session ID from sessionStorage
      const stored = sessionStorage.getItem("fall_detection_session_id");
      if (stored) return stored;
      // Generate new session ID
      const newId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("fall_detection_session_id", newId);
      return newId;
    }
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  // Build WS URL with session ID
  const wsUrlWithSession = typeof window !== "undefined"
    ? `${wsUrl}?session_id=${sessionId}`
    : wsUrl;

  // Use the camera hook for camera management
  const {
    videoRef,
    isCameraOn,
    error: cameraError,
    startCamera,
    stopCamera,
    toggleCamera,
  } = useCamera({ initialFacingMode: "user" });

  // Toast notifications
  const { toast } = useToast();

  // Error tracker
  const { errors, trackError, trackWarning, trackInfo, clearErrors: clearErrorTracker, resolveError, copyError, exportErrors } = useErrorTracker();

  // Handle fall detection with toast (cooldown handled by useFallDetection hook)
  const handleFallDetected = useCallback((score: number) => {
    toast({ type: 'warning', title: 'Fall Detected!', message: `Alert email sent (${(score * 100).toFixed(0)}% confidence)` });
  }, [toast]);

  // Use the detection hook for WebSocket and frame capture logic
  const {
    isDetecting,
    isConnected,
    detections,
    error: detectionError,
    frameCount,
    lastSent,
    lastReceived,
    wsStatus,
    confThreshold,
    startDetection,
    stopDetection,
    setConfThreshold,
  } = useFallDetection({
    wsUrl: wsUrlWithSession,
    onFallDetected: handleFallDetected,
  });

  // Track detection errors in error tracker
  useEffect(() => {
    if (detectionError) {
      trackError('detection', 'error', detectionError, {});
    }
  }, [detectionError, trackError]);

  // Track camera errors in error tracker
  useEffect(() => {
    if (cameraError) {
      trackError('camera', 'error', cameraError, {});
    }
  }, [cameraError, trackError]);

  // Track WebSocket connection status changes
  useEffect(() => {
    if (wsStatus === "CONNECTING") {
      trackInfo('websocket', 'WebSocket connecting...', {});
    } else if (wsStatus === "OPEN") {
      trackInfo('websocket', 'WebSocket connected', {});
    } else if (wsStatus === "CLOSED" && isDetecting) {
      trackWarning('websocket', 'WebSocket closed unexpectedly during detection', {});
    } else if (wsStatus === "CLOSED" && !isDetecting) {
      trackInfo('websocket', 'WebSocket closed (detection stopped)', {});
    }
  }, [wsStatus, isDetecting, trackInfo, trackWarning]);

  // Track frame send/receive
  useEffect(() => {
    if (lastSent && lastReceived) {
      const latency = lastReceived - lastSent;
      if (latency > 5000) {
        trackWarning('websocket', `High detection latency: ${latency}ms`, { latency });
      }
    }
  }, [lastSent, lastReceived, trackWarning]);

  // Local UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [combinedError, setCombinedError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [isEmailConfigured, setIsEmailConfigured] = useState(false);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // Combine errors from both hooks
  useEffect(() => {
    setCombinedError(cameraError || detectionError);
  }, [cameraError, detectionError]);

  // Register session with backend on mount
  useEffect(() => {
    let cancelled = false;
    const registerSession = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/session/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!response.ok && !cancelled) {
          console.warn('[WebcamDetector] Failed to register session:', await response.text());
        }
      } catch (err) {
        if (!cancelled) console.warn('[WebcamDetector] Session registration error:', err);
      }
    };
    void registerSession();
    return () => { cancelled = true; };
  }, [apiUrl, sessionId]);

  // Cleanup session on unmount (page refresh/close)
  useEffect(() => {
    return () => {
      // Use sendBeacon for reliable cleanup on page unload
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' });
        navigator.sendBeacon(`${apiUrl}/api/session/cleanup`, blob);
      }
      // Clear session storage
      sessionStorage.removeItem("fall_detection_session_id");
    };
  }, [apiUrl, sessionId]);

  // Fetch optional backend config
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
        }
      } catch {
        // Config is optional; the WebSocket detection path can still work.
      }
    };
    void fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, initialConfThreshold, setConfThreshold]);

  // Update target email on backend
  const updateTargetEmail = useCallback(async (targetEmail: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_email: targetEmail }),
      });
      if (!response.ok) {
        console.error('[WebcamDetector] Failed to update target email:', await response.text());
        toast({ type: 'error', title: 'Email Not Configured', message: 'email not configured' });
      } else {
        console.info('[WebcamDetector] Target email updated:', targetEmail);
        setIsEmailConfigured(true);
        toast({ type: 'success', title: 'Email Configured', message: 'email configured successfully' });
      }
    } catch (err) {
      console.error('[WebcamDetector] Failed to update target email:', err);
      toast({ type: 'error', title: 'Email Not Configured', message: 'email not configured' });
    }
  }, [apiUrl, toast]);

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

      const color = isFall ? "#ef4444" : "#22c55e"; // Red for fall, Green for normal
      const label = isFall ? `FALL ${(score * 100).toFixed(0)}%` : `Person ${(score * 100).toFixed(0)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1);

      // Label background
      ctx.fillStyle = color;
      const textWidth = ctx.measureText(label).width + 12;
      ctx.fillRect(sx1, sy1 - 28, textWidth, 26);

      // Label text
      ctx.fillStyle = "#fff";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillText(label, sx1 + 6, sy1 - 8);
    });
  }, [detections, videoRef]);

  // Wrapper functions for onClick handlers
  const handleStartCameraClick = useCallback(() => {
    void startCamera();
  }, [startCamera]);

  const handleStopCameraClick = useCallback(() => {
    void stopCamera();
    void stopDetection();
  }, [stopCamera, stopDetection]);

  const handleStartDetectionClick = useCallback(() => {
    if (videoRef.current) {
      if (!isEmailConfigured) {
        toast({ type: 'error', title: 'Email Required', message: 'Please set email first' });
        return;
      }
      void startDetection(videoRef.current);
    }
  }, [startDetection, isEmailConfigured, toast]);

  const handleStopDetectionClick = useCallback(() => {
    void stopDetection();
  }, [stopDetection]);

  const handleToggleCameraClick = useCallback(() => {
    void toggleCamera();
  }, [toggleCamera]);

  const handleConfChange = useCallback((value: number) => {
    setConfThreshold(value);
  }, [setConfThreshold]);

  // Check if any fall is detected
  const hasFall = detections?.falls.some((f) => f) ?? false;
  const personCount = detections?.boxes.length ?? 0;

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 shadow-xl">
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

          {/* Fall Alert Banner */}
          {hasFall && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-red-600 text-white px-4 py-3 text-center font-semibold text-lg animate-pulse">
              ⚠ FALL DETECTED - {personCount} person{personCount !== 1 ? "s" : ""} in frame
            </div>
          )}

          {/* Status Bar - Minimal, clean, at top */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-3">
              {/* Camera Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${isCameraOn ? "bg-green-500" : "bg-gray-400"}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {isCameraOn ? "Camera Active" : "Camera Off"}
                </span>
              </div>

              {/* Detection Status Indicator */}
              {isCameraOn && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${isDetecting ? "bg-green-500" : "bg-amber-500"}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {isDetecting ? "Detecting" : "Idle"}
                  </span>
                  {isDetecting && (
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 animate-pulse">● LIVE</span>
                  )}
                </div>
              )}

              {/* WS Connection Status */}
              {isDetecting && isConnected && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                  WS Connected
                </div>
              )}
            </div>

            {/* Person Count */}
            {detections && personCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {personCount} person{personCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Camera Switch Button - Bottom Right */}
          <CanvasButton
            variant="ghost"
            size="sm"
            onClick={handleToggleCameraClick}
            disabled={!isCameraOn}
            className="absolute bottom-4 right-4"
            aria-label="Switch camera"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </CanvasButton>

          {/* Placeholder when camera is off */}
          {!isCameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center bg-black/60 backdrop-blur-sm">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-white/20 flex items-center justify-center border border-white/10">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-2 text-white">Live Fall Detection</h3>
              <p className="text-white max-w-md mx-auto mb-8 text-base leading-relaxed">
                Click "Start Camera" in the controls below to activate your webcam. Then click "Start Detection" to begin real-time fall detection using AI.
              </p>
            </div>
          )}

          {/* Camera On but Detection Off - Minimal prompt */}
          {isCameraOn && !isDetecting && !hasFall && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg text-center">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Camera active — click "Start Detection" to begin AI analysis
              </span>
            </div>
          )}

          {/* Error Display - Clean banner at bottom */}
          {combinedError && (
            <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-red-600 text-white text-sm font-medium text-center animate-slide-up">
              {combinedError}
            </div>
          )}
        </div>

        {/* Controls Panel - Clean, minimal */}
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          {/* Camera Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <CanvasButton
                variant={isCameraOn ? "secondary" : "primary"}
                size="md"
                onClick={isCameraOn ? handleStopCameraClick : handleStartCameraClick}
              >
                {isCameraOn ? "Stop Camera" : "Start Camera"}
              </CanvasButton>

              <CanvasButton
                variant="ghost"
                size="md"
                onClick={handleToggleCameraClick}
                disabled={!isCameraOn}
              >
                Switch Camera
              </CanvasButton>

              {/* Email Input for Notifications */}
              <div className="hidden sm:flex items-center gap-2">
                <Label htmlFor="notification-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Email for alerts:
                </Label>
                <Input
                  id="notification-email"
                  type="email"
                  placeholder="Enter email for fall alerts"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-64 text-sm"
                  disabled={!isCameraOn}
                />
                <CanvasButton
                  variant="secondary"
                  size="sm"
                  onClick={() => email.trim() && void updateTargetEmail(email.trim())}
                  disabled={!isCameraOn || !email.trim()}
                >
                  Set Email
                </CanvasButton>
              </div>
            </div>

            {/* Settings Toggle */}
            <CanvasButton
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </CanvasButton>
          </div>

          {/* Detection Controls */}
          {isCameraOn && (
            <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 dark:bg-primary/10 dark:border-primary/800">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Detection:</span>
                  <CanvasButton
                    variant={isDetecting ? "danger" : "primary"}
                    size="md"
                    onClick={isDetecting ? handleStopDetectionClick : handleStartDetectionClick}
                    disabled={!isCameraOn || !isEmailConfigured}
                  >
                    {isDetecting ? "Stop Detection" : "Start Detection"}
                  </CanvasButton>
                  {!isEmailConfigured && !isDetecting && (
                    <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Set email first to start detection
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <span className={`font-mono font-medium ${isDetecting ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {isDetecting ? "Running" : "Stopped"}
                  </span>
                  {isConnected && (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                      WS Connected
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="mb-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
              <div>
                <Label htmlFor="conf-threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confidence Threshold: <span className="font-mono text-primary">{confThreshold.toFixed(2)}</span>
                </Label>
                <Input
                  id="conf-threshold"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={confThreshold}
                  onChange={(e) => handleConfChange(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Lower = more sensitive (more false positives). Higher = fewer detections.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="font-medium text-gray-900 dark:text-white">Model</div>
                  <div className="text-gray-500 dark:text-gray-400">YOLOv8n-pose</div>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="font-medium text-gray-900 dark:text-white">Backend</div>
                  <div className="text-gray-500 dark:text-gray-400">FastAPI + WebSocket</div>
                </div>
              </div>
            </div>
          )}

          {/* Detection Info - Only show when detections exist */}
          {detections && personCount > 0 && (
            <div className="mb-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Latest Detection</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Persons Detected</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{personCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Falls Detected</span>
                  <span className="font-mono font-medium text-red-600 dark:text-red-400">
                    {detections.falls.filter((f) => f).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Max Confidence</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {detections.scores.length > 0
                      ? (Math.max(...detections.scores) * 100).toFixed(1) + "%"
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Timestamp</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {new Date(detections.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Debug Info - Collapsed by default, minimal */}
          {(isCameraOn || isDetecting) && (
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                  Debug Info
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="mt-4 p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                <div className="grid grid-cols-2 gap-3 text-gray-600 dark:text-gray-300 font-mono">
                  <div><span className="font-medium">Camera:</span> {isCameraOn ? "On" : "Off"}</div>
                  <div><span className="font-medium">Detection:</span> {isDetecting ? "Running" : "Stopped"}</div>
                  <div><span className="font-medium">Frames Sent:</span> {frameCount}</div>
                  <div><span className="font-medium">WS Status:</span> {wsStatus}</div>
                  <div><span className="font-medium">Last Sent:</span> {lastSent ? `${((Date.now() - lastSent) / 1000).toFixed(1)}s ago` : "Never"}</div>
                  <div><span className="font-medium">Last Received:</span> {lastReceived ? `${((Date.now() - lastReceived) / 1000).toFixed(1)}s ago` : "Never"}</div>
                </div>
              </div>
            </details>
          )}

          {/* Error Checker Panel */}
          {(isCameraOn || isDetecting) && (
            <details className="group mt-4">
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Error Debugger
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="mt-4">
                <ErrorChecker
                  errors={errors}
                  onClear={clearErrorTracker}
                  onResolve={resolveError}
                  onCopy={copyError}
                  onExport={exportErrors}
                  maxHeight="300px"
                  title="Webcam Detection Errors"
                  showFilter={true}
                  showExport={true}
                />
              </div>
            </details>
          )}
        </div>

        <style jsx>{`
          @keyframes slide-up {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-slide-up {
            animation: slide-up 0.3s ease-out;
          }
          .animate-pulse {
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </CardContent>
    </Card>
  );
}

export default WebcamDetector;