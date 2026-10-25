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
  timestamp: number;
}

interface WebcamDetectorProps {
  /** WebSocket server URL */
  wsUrl?: string;
  /** REST API base URL for config */
  apiUrl?: string;
  /** Initial confidence threshold */
  initialConfThreshold?: number;
  /** Callback when fall is detected */
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
  const wsRef = useRef<WebSocket | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFallAlertRef = useRef<number>(0);

  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [confThreshold, setConfThreshold] = useState(initialConfThreshold);
  const [detections, setDetections] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [showSettings, setShowSettings] = useState(false);

  // Cleanup WebSocket
  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebcamDetector] WebSocket connected");
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            console.error("[WebcamDetector] Server error:", data.error);
            setError(data.error);
            return;
          }

          const result: DetectionResult = {
            boxes: data.boxes || [],
            scores: data.scores || [],
            falls: data.falls || [],
            timestamp: data.timestamp || Date.now(),
          };

          setDetections(result);

          // Check for falls and trigger callback
          const hasFall = result.falls.some((f) => f);
          if (hasFall && onFallDetected) {
            const fallScore = result.scores[result.falls.indexOf(true)] || 0;
            const now = Date.now();
            // Rate limit: only trigger once per 2 seconds
            if (now - lastFallAlertRef.current > 2000) {
              lastFallAlertRef.current = now;
              onFallDetected(fallScore);
            }
          }
        } catch (e) {
          console.error("[WebcamDetector] Failed to parse message:", e);
        }
      };

      ws.onclose = () => {
        console.log("[WebcamDetector] WebSocket disconnected");
        setIsConnected(false);
        // Auto-reconnect if still running
        if (isRunning) {
          setTimeout(connectWebSocket, 1000);
        }
      };

      ws.onerror = (err) => {
        console.error("[WebcamDetector] WebSocket error:", err);
        setError("Connection error. Check if backend is running on port 8000.");
      };
    } catch (e) {
      console.error("[WebcamDetector] Failed to create WebSocket:", e);
      setError("Failed to connect to detection server.");
    }
  }, [wsUrl, isRunning, onFallDetected]);

  // Start camera and detection
  const start = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Match canvas size to video
      const resizeCanvas = () => {
        if (videoRef.current && canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
      };

      videoRef.current?.addEventListener("loadedmetadata", resizeCanvas);

      // Connect WebSocket
      connectWebSocket();

      // Start frame capture loop
      const captureFrame = () => {
        if (!isRunning || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Convert to base64 JPEG
          canvas.toBlob(
            (blob) => {
              if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64data = reader.result as string;
                  wsRef.current?.send(
                    JSON.stringify({
                      image: base64data,
                      conf_threshold: confThreshold,
                    })
                  );
                };
                reader.readAsDataURL(blob);
              }
            },
            "image/jpeg",
            0.8
          );
        }

        animationRef.current = requestAnimationFrame(captureFrame);
      };

      setIsRunning(true);
      captureFrame();
    } catch (err) {
      console.error("[WebcamDetector] Camera error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to access camera. Please allow camera permissions."
      );
    }
  }, [facingMode, connectWebSocket, confThreshold, isRunning]);

  // Stop camera and detection
  const stop = useCallback(() => {
    setIsRunning(false);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    closeWebSocket();
    setDetections(null);
  }, [closeWebSocket]);

  // Toggle camera facing mode
  const toggleCamera = useCallback(() => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    if (isRunning) {
      stop();
      // Small delay to ensure camera is released
      setTimeout(start, 500);
    }
  }, [facingMode, isRunning, start, stop]);

  // Update confidence threshold
  const handleConfChange = useCallback((value: number) => {
    setConfThreshold(value);
    // Send to backend via WebSocket on next frame
  }, []);

  // Fetch config from REST API (optional)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/config`);
        if (res.ok) {
          const data = await res.json();
          setConfThreshold(data.conf_threshold || initialConfThreshold);
        }
      } catch {
        // Ignore config fetch errors
      }
    };
    fetchConfig();
  }, [apiUrl, initialConfThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Draw detections on overlay canvas
  useEffect(() => {
    if (!canvasRef.current || !detections || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear only the overlay (detections drawn on top)
    // Note: We don't clear here because the video frame is drawn in captureFrame
    // The detections are drawn AFTER the frame in the same canvas context

    // Actually, we need a separate overlay canvas for clean drawing
    // For now, we'll draw on the same canvas after the frame
    // This is handled in the captureFrame loop via a separate overlay
  }, [detections]);

  // We need a separate overlay canvas for drawing boxes
  // Let's render a second canvas on top
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!overlayRef.current || !detections || !videoRef.current) return;

    const overlay = overlayRef.current;
    const video = videoRef.current;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    // Resize overlay to match video
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw detection boxes
    detections.boxes.forEach((box, i) => {
      const [x1, y1, x2, y2] = box;
      const score = detections.scores[i];
      const isFall = detections.falls[i];

      const color = isFall ? "#ef4444" : "#f97316"; // Red for fall, Orange for normal
      const label = isFall ? `FALL ${(score * 100).toFixed(0)}%` : `${(score * 100).toFixed(0)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Label background
      ctx.fillStyle = color;
      const textWidth = ctx.measureText(label).width + 10;
      ctx.fillRect(x1, y1 - 24, textWidth, 24);

      // Label text
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(label, x1 + 5, y1 - 6);
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
              <span
                className={`w-3 h-3 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-white bg-black/50 px-2 py-1 rounded">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
              {isRunning && (
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
            disabled={!isRunning}
            className="absolute bottom-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Switch camera"
            title="Switch camera"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          {/* Placeholder when stopped */}
          {!isRunning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Live Fall Detection</h3>
              <p className="text-gray-400 max-w-md mx-auto mb-6">
                Click "Start Camera" to begin real-time fall detection using your webcam.
                The AI will analyze each frame and highlight any detected falls in red.
              </p>
              <Button variant="fancy" size="lg" onClick={start} disabled={isRunning}>
                Start Camera
              </Button>
            </div>
          )}

          {/* Error Display */}
          {error && isRunning && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 text-red-100 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div className="p-6 border-t border-border bg-gray-50 dark:bg-gray-900/50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant={isRunning ? "secondary" : "fancy"}
                size="lg"
                onClick={isRunning ? stop : start}
                disabled={isRunning && !isConnected}
                className="min-w-[140px]"
              >
                {isRunning ? "Stop Detection" : "Start Detection"}
              </Button>

              <Button variant="outline" size="lg" onClick={toggleCamera} disabled={!isRunning}>
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
        </div>
      </CardContent>
    </Card>
  );
}

export default WebcamDetector;