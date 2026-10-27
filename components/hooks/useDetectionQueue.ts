"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface QueueStats {
  active: number;
  max: number;
  available: number;
  connections: string[];
}

export interface UseDetectionQueueOptions {
  /** API base URL */
  apiUrl?: string;
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Called when queue position changes */
  onQueueChange?: (position: number, estimatedWait: number) => void;
  /** Called when a slot becomes available */
  onSlotAvailable?: () => void;
}

export interface UseDetectionQueueReturn {
  // State
  isQueued: boolean;
  queuePosition: number;
  estimatedWaitSeconds: number;
  stats: QueueStats | null;
  isPolling: boolean;

  // Controls
  joinQueue: () => Promise<boolean>;
  leaveQueue: () => void;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useDetectionQueue({
  apiUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000",
  pollInterval = 2000,
  onQueueChange,
  onSlotAvailable,
}: UseDetectionQueueOptions = {}): UseDetectionQueueReturn {
  const [isQueued, setIsQueued] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState(0);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasFullRef = useRef(false);

  const fetchStats = useCallback(async (): Promise<QueueStats | null> => {
    try {
      const response = await fetch(`${apiUrl}/api/ws/stats`);
      if (!response.ok) return null;
      const data = await response.json();
      return {
        active: data.active ?? 0,
        max: data.max ?? 5,
        available: data.available ?? 0,
        connections: data.connections ?? [],
      };
    } catch (err) {
      console.warn("[useDetectionQueue] Failed to fetch stats:", err);
      return null;
    }
  }, [apiUrl]);

  const poll = useCallback(async () => {
    const currentStats = await fetchStats();
    if (!currentStats) return;

    setStats(currentStats);

    const { active, max, available } = currentStats;
    const isFull = available <= 0;

    if (isQueued) {
      if (!isFull) {
        // Slot available!
        setIsQueued(false);
        setQueuePosition(0);
        setEstimatedWaitSeconds(0);
        onSlotAvailable?.();
      } else {
        // Still queued - estimate position (active - max + 1)
        const position = Math.max(1, active - max + 1);
        setQueuePosition(position);
        // Rough estimate: assume each upload takes ~30 seconds per 100 frames
        // This is very rough; could be improved with actual processing time data
        const estimatedWait = position * 30;
        setEstimatedWaitSeconds(estimatedWait);
        onQueueChange?.(position, estimatedWait);
      }
    }

    // Track when we go from not-full to full
    if (wasFullRef.current && !isFull) {
      wasFullRef.current = false;
    } else if (!wasFullRef.current && isFull) {
      wasFullRef.current = true;
    }
  }, [fetchStats, isQueued, onQueueChange, onSlotAvailable]);

  const joinQueue = useCallback(async (): Promise<boolean> => {
    const currentStats = await fetchStats();
    if (!currentStats) return false;

    if (currentStats.available > 0) {
      // Slot available immediately
      return true;
    }

    // No slot available, join queue
    setIsQueued(true);
    const position = Math.max(1, currentStats.active - currentStats.max + 1);
    setQueuePosition(position);
    setEstimatedWaitSeconds(position * 30);
    onQueueChange?.(position, position * 30);
    return false; // false = queued, true = got slot immediately
  }, [fetchStats, onQueueChange]);

  const leaveQueue = useCallback(() => {
    setIsQueued(false);
    setQueuePosition(0);
    setEstimatedWaitSeconds(0);
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    setIsPolling(true);
    poll(); // Initial poll
    pollIntervalRef.current = setInterval(poll, pollInterval);
  }, [poll, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // State
    isQueued,
    queuePosition,
    estimatedWaitSeconds,
    stats,
    isPolling,

    // Controls
    joinQueue,
    leaveQueue,
    startPolling,
    stopPolling,
  };
}

export default useDetectionQueue;