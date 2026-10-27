"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CanvasButton } from "./CanvasButton";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Input } from "./Input";
import { Label } from "./Input";
import { useToast } from "./ToastProvider";
import { useErrorTracker } from "../hooks/useErrorTracker";
import { useVideoFileDetection, type DetectionResult } from "../hooks/useVideoFileDetection";
import { useVideoCache } from "../hooks/useVideoCache";
import { useFallAlert } from "../hooks/useFallAlert";
import { ErrorChecker } from "./ErrorChecker";

interface ChunkedJob {
  status: "idle" | "processing" | "completed" | "failed";
  progress: number;
  results: Array<{
    boxes: number[][];
    scores: number[];
    falls: boolean[];
    timestamp: number;
  }>;
  error?: string;
  sessionId?: string;
  videoName?: string;
}

export interface VideoUploadDetectorProps {
  /** WebSocket URL for real-time detection */
  wsUrl?: string;
  /** REST API base URL (fallback) */
  apiUrl?: string;
  /** Initial confidence threshold */
  initialConfThreshold?: number;
  /** Callback when processing completes */
  onComplete?: (job: ChunkedJob) => void;
}

export function VideoUploadDetector({
  wsUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"
    : "ws://localhost:8000",
  apiUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000",
  initialConfThreshold = 0.6,
  onComplete,
}: VideoUploadDetectorProps) {
  // Generate session ID on mount (shared with WebcamDetector)
  const [sessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("fall_detection_session_id");
      if (stored) return stored;
      const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem("fall_detection_session_id", newId);
      return newId;
    }
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const [job, setJob] = useState<ChunkedJob>({
    status: "idle",
    progress: 0,
    results: [],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confThreshold, setConfThreshold] = useState(initialConfThreshold);
  const [chunkSize, setChunkSize] = useState(10); // Frames per chunk
  const [totalChunks, setTotalChunks] = useState(24); // Max chunks
  const [maxResolution, setMaxResolution] = useState(640);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notifications
  const { toast } = useToast();

  // Fall alert hook - handles email configuration and fall detection notifications
  const {
    isEmailConfigured,
    email,
    setEmail,
    configureEmail,
    triggerFallAlert,
    checkEmailConfigured,
  } = useFallAlert({
    apiUrl,
    sessionId,
    onFallDetected: (score, emailSent) => {
      // Could add additional logging here if needed
      console.info("[VideoUploadDetector] Fall alert triggered:", { score, emailSent });
    },
  });

  // Register session with backend on mount
  useEffect(() => {
    let cancelled = false;
    const registerSession = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/session/register?session_id=${encodeURIComponent(sessionId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok && !cancelled) {
          console.warn('[VideoUploadDetector] Failed to register session:', await response.text());
        }
      } catch (err) {
        if (!cancelled) console.warn('[VideoUploadDetector] Session registration error:', err);
      }
    };
    void registerSession();
    return () => { cancelled = true; };
  }, [apiUrl, sessionId]);

  // Cleanup session on unmount (page refresh/close)
  useEffect(() => {
    return () => {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' });
        navigator.sendBeacon(`${apiUrl}/api/session/cleanup`, blob);
      }
      sessionStorage.removeItem("fall_detection_session_id");
    };
  }, [apiUrl, sessionId]);

  // Error tracker
  const {
    errors,
    trackError,
    trackInfo,
    clearErrors: clearErrorTracker,
    resolveError,
    copyError,
    exportErrors
  } = useErrorTracker();

  // Track upload errors
  useEffect(() => {
    if (error) {
      trackError('video-upload', 'error', error);
    }
  }, [error, trackError]);

  // Track job status changes
  useEffect(() => {
    if (job.status === "failed" && job.error) {
      trackError('backend', 'error', `Video processing failed: ${job.error}`, { sessionId: job.sessionId });
    } else if (job.status === "completed") {
      trackInfo('video-upload', `Video processing completed: ${job.sessionId}`, {
        sessionId: job.sessionId,
        framesProcessed: job.results?.length
      });
    }
  }, [job, trackError, trackInfo]);

  // Initialize hooks
  const { isReady: cacheReady, clearSessionCache, saveSession, getAllSessions, updateSession } = useVideoCache();

  const {
    isProcessing,
    currentFrame,
    totalFrames,
    framesSent,
    framesReceived,
    error: detectionError,
    processVideo,
    cancelProcessing,
    reset: resetDetection,
  } = useVideoFileDetection({
    wsUrl: `${wsUrl}/ws/detect?session_id=${sessionId}`,
    apiUrl,
    fps: 10,
    maxResolution,
    confThreshold,
    sessionId,
    onFrameResult: (result: DetectionResult) => {
      // Store result
      setJob(prev => ({
        ...prev,
        results: [...prev.results, {
          boxes: result.boxes,
          scores: result.scores,
          falls: result.falls,
          timestamp: result.timestamp,
        }],
        progress: totalFrames > 0 ? result.frame_index / totalFrames : 0,
      }));
    },
    onFrameError: (frameIndex, err) => {
      trackError('video-upload', 'error', `Frame ${frameIndex} failed: ${err.message}`, { frameIndex });
    },
    onFallDetected: (score, _frameIndex, emailSent, emailAlertResult) => {
      // Use the shared fall alert hook to handle notifications with actual backend result
      triggerFallAlert(score, emailSent, emailAlertResult);
    },
    onProgress: (p) => {
      setJob(prev => ({ ...prev, progress: p }));
    },
    onComplete: (allResults) => {
      trackInfo('video-upload', `Video processing completed: ${sessionId}`, {
        sessionId,
        framesProcessed: allResults.length,
      });
    },
    onError: (err) => {
      trackError('video-upload', 'error', `Processing failed: ${err}`, { sessionId });
    },
  });

  // Sync detection error to local error state
  useEffect(() => {
    if (detectionError) {
      setError(detectionError);
    }
  }, [detectionError]);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
      if (!allowedTypes.includes(file.type)) {
        setError("Unsupported format. Please use MP4, MOV, AVI, or MKV.");
        setSelectedFile(null);
        return;
      }
      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        setError("File too large. Maximum size is 100MB.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
      // Reset job state when new file selected
      setJob({ status: "idle", progress: 0, results: [] });
      resetDetection();
    }
  }, [resetDetection]);

  // Process video with WebSocket approach
  const handleProcess = useCallback(async () => {
    if (!selectedFile) return;

    if (!isEmailConfigured) {
      toast({ type: 'error', title: 'Email Required', message: 'Please set email first' });
      return;
    }

    if (!cacheReady) {
      setError("Cache system not ready. Please wait a moment and try again.");
      return;
    }

    setError(null);
    setJob({
      status: "processing",
      progress: 0,
      results: [],
      sessionId,
      videoName: selectedFile.name,
    });

    try {
      // Save session to cache
      await saveSession({
        videoName: selectedFile.name,
        videoSize: selectedFile.size,
        videoType: selectedFile.type,
        totalChunks: Math.ceil((selectedFile.size / (1024 * 1024)) * 10), // Estimate
        chunkSize,
        status: "processing",
      });

      const allResults = await processVideo(selectedFile);

      setJob({
        status: "completed",
        progress: 1,
        results: allResults,
        sessionId,
        videoName: selectedFile.name,
      });

      // Update session status in cache
      const sessions = await getAllSessions();
      const currentSession = sessions.find((s) => s.id === sessionId);
      if (currentSession) {
        await updateSession({ ...currentSession, status: "completed", completedAt: Date.now() });
      }

      setSelectedFile(null);
      toast({ type: 'success', title: 'Processing Complete', message: `Analyzed ${allResults.length} frames` });
      if (onComplete) onComplete(job);
    } catch (err) {
      console.error("[VideoUploadDetector] Processing error:", err);
      const errorMsg = err instanceof Error ? err.message : "Processing failed. Please try again.";
      setError(errorMsg);
      setJob(prev => ({ ...prev, status: "failed", error: errorMsg }));
    }
  }, [selectedFile, isEmailConfigured, cacheReady, processVideo, chunkSize, sessionId, apiUrl, toast, onComplete, job, saveSession, getAllSessions, updateSession]);

  // Cancel processing
  const handleCancel = useCallback(() => {
    cancelProcessing();
    setJob({ status: "idle", progress: 0, results: [] });
  }, [cancelProcessing]);

  // Reset to initial state
  const handleReset = useCallback(async () => {
    cancelProcessing();
    resetDetection();
    if (job.sessionId) {
      await clearSessionCache(job.sessionId);
    }
    setJob({ status: "idle", progress: 0, results: [] });
    setSelectedFile(null);
    setError(null);
  }, [cancelProcessing, resetDetection, job.sessionId, clearSessionCache]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const hasFall = job.results?.some((r) => r.falls.some((f) => f)) ?? false;
  const fallCount = job.results?.filter((r) => r.falls.some((f) => f)).length ?? 0;
  const maxConfidence = job.results?.length > 0
    ? (Math.max(...job.results.flatMap((r) => r.scores)) * 100).toFixed(1) + "%"
    : "N/A";
  const fallRate = job.results?.length > 0
    ? (fallCount / job.results.length * 100).toFixed(1) + "%"
    : "0%";

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl">Video Upload & Analysis</CardTitle>
        <p className="text-muted-foreground mt-1">
          Upload a video file to analyze for fall detection. The AI processes frames in chunks
          and generates detection results in real-time.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload Zone */}
        {job.status === "idle" && (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
              selectedFile
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
              const file = e.dataTransfer.files[0];
              if (file) {
                const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleFileChange(event);
              }
            }}
          >
            <input
              type="file"
              id="video-upload"
              ref={fileInputRef}
              accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
            <label
              htmlFor="video-upload"
              className="cursor-pointer"
              style={{ pointerEvents: isProcessing ? "none" : "auto" }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {selectedFile ? "File Selected" : "Drop video file here or click to browse"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {selectedFile
                  ? `${selectedFile.name} • ${formatSize(selectedFile.size)}`
                  : "Supports MP4, MOV, AVI, MKV (max 100MB)"}
              </p>
              {!selectedFile && (
                <CanvasButton
                  variant="ghost"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </CanvasButton>
              )}
            </label>

            {selectedFile && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="flex items-center gap-4 p-4 bg-background rounded-xl border border-border min-w-75">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" aria-hidden="true">
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <path d="M8 12l4 4 8-8" />
                    </svg>
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-medium text-foreground truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatSize(selectedFile.size)} • {selectedFile.type}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <CanvasButton variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                    Remove
                  </CanvasButton>
                  <CanvasButton variant="primary" size="lg" onClick={handleProcess} disabled={isProcessing || !isEmailConfigured} isLoading={isProcessing}>
                    {isProcessing ? "Processing..." : "Analyze Video"}
                  </CanvasButton>
                  {!isEmailConfigured && !isProcessing && (
                    <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1 self-center sm:self-start">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Set email first to analyze video
                    </span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Processing Status */}
        {job.status === "processing" && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary/20 border-t-primary animate-spin" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Processing Video...</h3>
              <p className="text-muted-foreground">Analyzing frames for fall detection (frame {currentFrame + 1} of {totalFrames})</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{Math.round(job.progress * 100)}%</span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${job.progress * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                Session: {job.sessionId} • Frames: {framesSent} sent / {framesReceived} received
              </p>
            </div>

            <CanvasButton variant="ghost" size="md" onClick={handleCancel}>
              Cancel
            </CanvasButton>
          </div>
        )}

        {/* Results */}
        {(job.status === "completed" || job.status === "failed") && (
          <div className="space-y-4">
            {job.status === "completed" ? (
              <>
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">Processing Complete</h3>
                    <p className="text-green-700 text-sm">Analyzed {job.results.length} frames.</p>
                  </div>
                </div>

                {job.results && job.results.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-3">Detection Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-gray-900 dark:bg-gray-900 rounded-xl text-white">
                        <div className="text-2xl font-bold">
                          {job.results.length}
                        </div>
                        <div className="text-sm text-gray-300">Frames Processed</div>
                      </div>
                      <div className="p-4 bg-gray-900 dark:bg-gray-900 rounded-xl text-white">
                        <div className="text-2xl font-bold text-red-400">
                          {fallCount}
                        </div>
                        <div className="text-sm text-gray-300">Frames with Falls</div>
                      </div>
                      <div className="p-4 bg-gray-900 dark:bg-gray-900 rounded-xl text-white">
                        <div className="text-2xl font-bold">
                          {maxConfidence}
                        </div>
                        <div className="text-sm text-gray-300">Max Confidence</div>
                      </div>
                      <div className="p-4 bg-gray-900 dark:bg-gray-900 rounded-xl text-white">
                        <div className="text-2xl font-bold">
                          {fallRate}
                        </div>
                        <div className="text-sm text-gray-300">Fall Rate</div>
                      </div>
                    </div>

                    {/* Fall Timeline */}
                    {hasFall && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <h5 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Fall Events Timeline
                        </h5>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {job.results
                            .filter((r) => r.falls.some((f) => f))
                            .slice(0, 20)
                            .map((r, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white rounded-lg">
                                <span className="text-red-700 font-medium">
                                  {formatTime(r.timestamp)}
                                </span>
                                <span className="text-red-600">
                                  {r.falls.filter((f) => f).length} fall{r.falls.filter((f) => f).length !== 1 ? "s" : ""} • Max: {(Math.max(...r.scores) * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          {fallCount > 20 && (
                            <p className="text-xs text-red-600 text-center">
                              ... and {fallCount - 20} more fall events
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  <CanvasButton variant="primary" size="lg" onClick={handleReset} className="w-full sm:w-auto">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Analyze Another Video
                  </CanvasButton>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-800">Processing Failed</h3>
                    <p className="text-red-700 text-sm">{job.error || "Unknown error occurred"}</p>
                  </div>
                </div>
                <CanvasButton variant="ghost" size="lg" onClick={handleReset} className="mt-4 w-full sm:w-auto">
                  Try Again
                </CanvasButton>
              </div>
            )}
          </div>
        )}

        {/* Email Alerts - Always visible for better UX */}
        <div className="border-t border-border pt-6">
          <Label htmlFor="video-email" className="block text-sm font-medium mb-2">
            Email for Alerts
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="video-email"
              type="email"
              placeholder="Enter email for fall alerts"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full sm:flex-1 text-sm"
            />
            <CanvasButton
              variant="secondary"
              size="sm"
              onClick={() => email.trim() && void configureEmail(email.trim())}
              disabled={!email.trim()}
            >
              Set Email
            </CanvasButton>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Fall detection alerts will be sent to this email address.
          </p>
        </div>

        {/* Settings */}
        <details className="group border-t border-border pt-6">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="font-medium text-foreground">Advanced Settings</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="video-conf-threshold" className="block text-sm font-medium mb-2">
                Confidence Threshold: {confThreshold.toFixed(2)}
              </Label>
              <Input
                id="video-conf-threshold"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lower = more sensitive (more false positives). Higher = fewer detections.
              </p>
            </div>
            <div>
              <Label htmlFor="video-chunk-size" className="block text-sm font-medium mb-2">
                Frames per Chunk: {chunkSize}
              </Label>
              <Input
                id="video-chunk-size"
                type="range"
                min="5"
                max="20"
                step="1"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of frames sent per batch. Lower = more frequent updates, higher overhead.
              </p>
            </div>
            <div>
              <Label htmlFor="video-total-chunks" className="block text-sm font-medium mb-2">
                Max Chunks: {totalChunks}
              </Label>
              <Input
                id="video-total-chunks"
                type="range"
                min="12"
                max="48"
                step="4"
                value={totalChunks}
                onChange={(e) => setTotalChunks(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of chunks to process. 24 chunks × 10 frames = 240 frames max.
              </p>
            </div>
            <div>
              <Label htmlFor="video-max-resolution" className="block text-sm font-medium mb-2">
                Max Resolution: {maxResolution}px
              </Label>
              <Input
                id="video-max-resolution"
                type="range"
                min="320"
                max="1280"
                step="80"
                value={maxResolution}
                onChange={(e) => setMaxResolution(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Frames resized to this max dimension before inference. Lower = less memory, faster.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Backend: FastAPI + YOLOv8n-pose</p>
              <p>Processing: Client-side chunking with server-side detection</p>
            </div>
          </div>
        </details>

        {/* Error Checker Panel */}
        <details className="group border-t border-border pt-6">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="font-medium text-foreground">Error Debugger</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">
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
              title="Video Upload Errors"
              showFilter={true}
              showExport={true}
            />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export default VideoUploadDetector;