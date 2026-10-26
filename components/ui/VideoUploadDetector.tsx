"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CanvasButton } from "./CanvasButton";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Input } from "./Input";
import { Label } from "./Input";
import { useToast } from "./ToastProvider";

interface VideoJob {
  job_id: string;
  status: "processing" | "completed" | "failed";
  progress: number;
  results?: Array<{
    boxes: number[][];
    scores: number[];
    falls: boolean[];
    timestamp: number;
  }>;
  error?: string;
  download_url?: string;
}

export interface VideoUploadDetectorProps {
  /** REST API base URL */
  apiUrl?: string;
  /** Initial confidence threshold */
  initialConfThreshold?: number;
  /** Callback when processing completes */
  onComplete?: (job: VideoJob) => void;
}

export function VideoUploadDetector({
  apiUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000",
  initialConfThreshold = 0.6,
  onComplete,
}: VideoUploadDetectorProps) {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confThreshold, setConfThreshold] = useState(initialConfThreshold);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [email, setEmail] = useState("");
  const [isEmailConfigured, setIsEmailConfigured] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notifications
  const { toast } = useToast();

  // Update target email on backend
  const updateTargetEmail = useCallback(async (targetEmail: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_email: targetEmail }),
      });
      if (!response.ok) {
        console.error('[VideoUploadDetector] Failed to update target email:', await response.text());
        toast({ type: 'error', title: 'Email Not Configured', message: 'email not configured' });
      } else {
        console.info('[VideoUploadDetector] Target email updated:', targetEmail);
        setIsEmailConfigured(true);
        toast({ type: 'success', title: 'Email Configured', message: 'email configured successfully' });
      }
    } catch (err) {
      console.error('[VideoUploadDetector] Failed to update target email:', err);
      toast({ type: 'error', title: 'Email Not Configured', message: 'email not configured' });
    }
  }, [apiUrl, toast]);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/detect/video/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const data: VideoJob = await res.json();
      setJob(data);

      if (data.status === "completed" || data.status === "failed") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (onComplete) onComplete(data);
      }
    } catch (err) {
      console.error("[VideoUploadDetector] Poll error:", err);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setError("Failed to check processing status.");
    }
  }, [apiUrl, onComplete]);

  // Start polling
  const startPolling = useCallback(
    (jobId: string) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      pollIntervalRef.current = setInterval(() => pollJobStatus(jobId), 2000);
      // Initial poll
      pollJobStatus(jobId);
    },
    [pollJobStatus]
  );

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

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
    }
  }, []);

  // Upload video
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    if (!isEmailConfigured) {
      toast({ type: 'error', title: 'Email Required', message: 'Please set email first' });
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("conf_threshold", confThreshold.toString());

      const res = await fetch(`${apiUrl}/api/detect/video`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }

      const data: { job_id: string; status: string; message: string } = await res.json();
      setJob({
        job_id: data.job_id,
        status: "processing",
        progress: 0,
      });
      startPolling(data.job_id);
      setSelectedFile(null);
    } catch (err) {
      console.error("[VideoUploadDetector] Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, confThreshold, apiUrl, startPolling, isEmailConfigured, toast]);

  // Download processed video
  const handleDownload = useCallback(() => {
    if (job?.download_url) {
      const a = document.createElement("a");
      a.href = `${apiUrl}${job.download_url}`;
      a.download = `fall_detection_${job.job_id}_annotated.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [job, apiUrl]);

  // Reset to initial state
  const handleReset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setJob(null);
    setSelectedFile(null);
    setError(null);
  }, []);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl">Video Upload & Analysis</CardTitle>
        <p className="text-muted-foreground mt-1">
          Upload a video file to analyze for fall detection. The AI will process each frame
          and generate an annotated video with detection boxes.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload Zone */}
        {!job && (
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
              disabled={isUploading}
            />
            <label
              htmlFor="video-upload"
              className="cursor-pointer"
              style={{ pointerEvents: isUploading ? "none" : "auto" }}
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
                <div className="flex items-center gap-4 p-4 bg-background rounded-xl border border-border min-w-[300px]">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
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
                  <CanvasButton variant="primary" size="lg" onClick={handleUpload} disabled={isUploading || !isEmailConfigured} isLoading={isUploading}>
                    Upload & Analyze
                  </CanvasButton>
                  {!isEmailConfigured && !isUploading && (
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
        {job && job.status === "processing" && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary/20 border-t-primary animate-spin" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Processing Video...</h3>
              <p className="text-muted-foreground">Analyzing frames for fall detection</p>
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
                Job ID: {job.job_id}
              </p>
            </div>

            <CanvasButton variant="ghost" size="md" onClick={handleReset}>
              Cancel
            </CanvasButton>
          </div>
        )}

        {/* Results */}
        {job && (job.status === "completed" || job.status === "failed") && (
          <div className="space-y-4">
            {job.status === "completed" ? (
              <>
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">Processing Complete</h3>
                    <p className="text-green-700 text-sm">Your annotated video is ready for download.</p>
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
                          {job.results.filter((r) => r.falls.some((f) => f)).length}
                        </div>
                        <div className="text-sm text-gray-300">Frames with Falls</div>
                      </div>
                      <div className="p-4 bg-gray-900 dark:bg-gray-900 rounded-xl text-white">
                        <div className="text-2xl font-bold">
                          {job.results.length > 0
                            ? (Math.max(...job.results.flatMap((r) => r.scores)) * 100).toFixed(1) + "%"
                            : "N/A"}
                        </div>
                        <div className="text-sm text-gray-300">Max Confidence</div>
                      </div>
                      <div className="p-4 bg-gray-900 dark:bg-gray-900 rounded-xl text-white">
                        <div className="text-2xl font-bold">
                          {job.results.length > 0
                            ? (job.results.filter((r) => r.falls.some((f) => f)).length / job.results.length * 100).toFixed(1) + "%"
                            : "0%"}
                        </div>
                        <div className="text-sm text-gray-300">Fall Rate</div>
                      </div>
                    </div>

                    {/* Fall Timeline */}
                    {job.results.some((r) => r.falls.some((f) => f)) && (
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
                          {job.results.filter((r) => r.falls.some((f) => f)).length > 20 && (
                            <p className="text-xs text-red-600 text-center">
                              ... and {job.results.filter((r) => r.falls.some((f) => f)).length - 20} more fall events
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  <CanvasButton variant="primary" size="lg" onClick={handleDownload} className="w-full sm:w-auto">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Annotated Video
                  </CanvasButton>
                  <CanvasButton variant="ghost" size="lg" onClick={handleReset} className="w-full sm:w-auto">
                    Analyze Another Video
                  </CanvasButton>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
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
              onClick={() => email.trim() && void updateTargetEmail(email.trim())}
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
            <div className="text-sm text-muted-foreground">
              <p>Backend: FastAPI + YOLOv8n-pose</p>
              <p>Processing: Server-side (frames sent to backend)</p>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export default VideoUploadDetector;