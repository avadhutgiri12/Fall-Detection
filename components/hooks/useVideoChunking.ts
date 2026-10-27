"use client";

import { useCallback, useRef, useState } from "react";

export interface ChunkConfig {
  totalFrames: number;
  chunkSize: number;
  totalChunks: number;
}

export interface VideoFrame {
  index: number;
  blob: Blob;
  timestamp: number;
}

export interface ChunkResult {
  chunkIndex: number;
  frames: number;
  results: Array<{
    boxes: number[][];
    scores: number[];
    falls: boolean[];
    timestamp: number;
  }>;
  processingTime: number;
}

export interface UseVideoChunkingOptions {
  /** Number of frames per chunk (default: 10) */
  chunkSize?: number;
  /** Total number of chunks to process (default: 24) */
  totalChunks?: number;
  /** Confidence threshold for detection */
  confThreshold?: number;
  /** Max resolution for inference */
  maxResolution?: number;
  /** WebSocket URL for sending chunks */
  wsUrl?: string;
  /** REST API URL for chunk detection */
  apiUrl?: string;
  /** Callback when a chunk is processed */
  onChunkComplete?: (result: ChunkResult) => void;
  /** Callback for progress updates (0-1) */
  onProgress?: (progress: number) => void;
  /** Callback for errors */
  onError?: (error: string, chunkIndex?: number) => void;
}

export interface UseVideoChunkingReturn {
  // State
  isProcessing: boolean;
  currentChunk: number;
  totalChunks: number;
  processedChunks: number;
  error: string | null;
  chunkResults: ChunkResult[];

  // Controls
  processVideo: (videoFile: File) => Promise<ChunkResult[]>;
  cancelProcessing: () => void;
  reset: () => void;
}

export function useVideoChunking({
  chunkSize = 10,
  totalChunks = 24,
  confThreshold = 0.6,
  maxResolution = 640,
  wsUrl,
  apiUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000",
  onChunkComplete,
  onProgress,
  onError,
}: UseVideoChunkingOptions = {}): UseVideoChunkingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [processedChunks, setProcessedChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [chunkResults, setChunkResults] = useState<ChunkResult[]>([]);

  const cancelRef = useRef(false);

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
          const totalFrames = Math.floor(duration * 30); // Assume 30 FPS
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

  const sendChunkViaWebSocket = useCallback(
    async (frames: VideoFrame[], chunkIndex: number): Promise<ChunkResult> => {
      if (!wsUrl) throw new Error("WebSocket URL not provided");

      return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const startTime = performance.now();

        ws.onopen = () => {
          // Send all frames in this chunk
          frames.forEach((frame) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                ws.send(
                  JSON.stringify({
                    image: reader.result,
                    conf_threshold: confThreshold,
                    chunk_index: chunkIndex,
                    frame_index: frame.index,
                    timestamp: frame.timestamp,
                  })
                );
              }
            };
            reader.readAsDataURL(frame.blob);
          });
        };

        const results: ChunkResult["results"] = [];
        let receivedCount = 0;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              ws.close();
              reject(new Error(data.error));
              return;
            }

            results.push({
              boxes: data.boxes || [],
              scores: data.scores || [],
              falls: data.falls || [],
              timestamp: data.timestamp || Date.now() / 1000,
            });
            receivedCount++;

            if (receivedCount >= frames.length) {
              ws.close();
              resolve({
                chunkIndex,
                frames: frames.length,
                results,
                processingTime: performance.now() - startTime,
              });
            }
          } catch (err) {
            ws.close();
            reject(err);
          }
        };

        ws.onerror = () => {
          reject(new Error("WebSocket error"));
        };

        ws.onclose = () => {
          if (receivedCount === 0) {
            reject(new Error("WebSocket closed before receiving results"));
          }
        };

        // Timeout after 30 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
            reject(new Error("Chunk processing timeout"));
          }
        }, 30000);
      });
    },
    [wsUrl, confThreshold]
  );

  const sendChunkViaREST = useCallback(
    async (frames: VideoFrame[], chunkIndex: number): Promise<ChunkResult> => {
      const startTime = performance.now();

      // Convert frames to base64
      const framePromises = frames.map((frame) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read frame"));
          reader.readAsDataURL(frame.blob);
        })
      );

      const images = await Promise.all(framePromises);

      const response = await fetch(`${apiUrl}/api/detect/chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          conf_threshold: confThreshold,
          chunk_index: chunkIndex,
          frame_indices: frames.map((f) => f.index),
          timestamps: frames.map((f) => f.timestamp),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Chunk processing failed" }));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      return {
        chunkIndex,
        frames: frames.length,
        results,
        processingTime: performance.now() - startTime,
      };
    },
    [apiUrl, confThreshold]
  );

  const processVideo = useCallback(
    async (videoFile: File): Promise<ChunkResult[]> => {
      if (isProcessing) return [];

      cancelRef.current = false;
      setIsProcessing(true);
      setError(null);
      setCurrentChunk(0);
      setProcessedChunks(0);
      setChunkResults([]);

      // Create video element to get metadata
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const url = URL.createObjectURL(videoFile);
      video.src = url;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });

      const duration = video.duration;
      const estimatedFPS = 30;
      const totalFrames = Math.floor(duration * estimatedFPS);
      const actualTotalChunks = Math.min(totalChunks, Math.ceil(totalFrames / chunkSize));

      URL.revokeObjectURL(url);

      const results: ChunkResult[] = [];

      for (let chunkIndex = 0; chunkIndex < actualTotalChunks; chunkIndex++) {
        if (cancelRef.current) break;

        setCurrentChunk(chunkIndex);
        onProgress?.((chunkIndex + 1) / actualTotalChunks);

        const startFrame = chunkIndex * chunkSize;
        const framesToExtract = Math.min(chunkSize, totalFrames - startFrame);

        try {
          const frames = await extractFramesFromVideo(videoFile, startFrame, framesToExtract);

          if (frames.length === 0) {
            console.warn(`[useVideoChunking] No frames extracted for chunk ${chunkIndex}`);
            continue;
          }

          let result: ChunkResult;

          if (wsUrl) {
            result = await sendChunkViaWebSocket(frames, chunkIndex);
          } else {
            result = await sendChunkViaREST(frames, chunkIndex);
          }

          results.push(result);
          setChunkResults(results);
          setProcessedChunks(chunkIndex + 1);
          onChunkComplete?.(result);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          setError(`Chunk ${chunkIndex} failed: ${errorMsg}`);
          onError?.(errorMsg, chunkIndex);

          // Continue with next chunk instead of failing entirely
          console.error(`[useVideoChunking] Chunk ${chunkIndex} error:`, err);
        }
      }

      setIsProcessing(false);
      onProgress?.(1);
      return results;
    },
    [
      isProcessing,
      chunkSize,
      totalChunks,
      extractFramesFromVideo,
      sendChunkViaWebSocket,
      sendChunkViaREST,
      wsUrl,
      onChunkComplete,
      onProgress,
      onError,
    ]
  );

  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;
    setIsProcessing(false);
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    setIsProcessing(false);
    setCurrentChunk(0);
    setProcessedChunks(0);
    setError(null);
    setChunkResults([]);
  }, []);

  return {
    isProcessing,
    currentChunk,
    totalChunks: Math.min(totalChunks, 24),
    processedChunks,
    error,
    chunkResults,
    processVideo,
    cancelProcessing,
    reset,
  };
}

export default useVideoChunking;