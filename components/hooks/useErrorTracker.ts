"use client";

import { useState, useCallback, useEffect } from "react";

export type ErrorSource = 'websocket' | 'camera' | 'video-upload' | 'detection' | 'network' | 'backend' | 'unknown';
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorEntry {
  id: string;
  timestamp: number;
  source: ErrorSource;
  severity: ErrorSeverity;
  message: string;
  details?: Record<string, unknown>;
  resolved: boolean;
}

const STORAGE_KEY = "fall_detection_errors";
const MAX_ERRORS = 100;

export function useErrorTracker() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);

  // Load errors from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setErrors(parsed.slice(-MAX_ERRORS));
          }
        }
      } catch (err) {
        console.warn("[useErrorTracker] Failed to load errors from storage:", err);
      }
    }
  }, []);

  // Save errors to sessionStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(-MAX_ERRORS)));
      } catch (err) {
        console.warn("[useErrorTracker] Failed to save errors to storage:", err);
      }
    }
  }, [errors]);

  const trackError = useCallback((
    source: ErrorSource,
    severity: ErrorSeverity,
    message: string,
    details?: Record<string, unknown>
  ) => {
    const entry: ErrorEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source,
      severity,
      message,
      details,
      resolved: false,
    };
    setErrors(prev => [entry, ...prev].slice(0, MAX_ERRORS));
    return entry.id;
  }, []);

  const trackInfo = useCallback((source: ErrorSource, message: string, details?: Record<string, unknown>) => {
    return trackError(source, 'info', message, details);
  }, [trackError]);

  const trackWarning = useCallback((source: ErrorSource, message: string, details?: Record<string, unknown>) => {
    return trackError(source, 'warning', message, details);
  }, [trackError]);

  const trackErrorFn = useCallback((source: ErrorSource, message: string, details?: Record<string, unknown>) => {
    return trackError(source, 'error', message, details);
  }, [trackError]);

  const trackCritical = useCallback((source: ErrorSource, message: string, details?: Record<string, unknown>) => {
    return trackError(source, 'critical', message, details);
  }, [trackError]);

  const resolveError = useCallback((id: string) => {
    setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearResolved = useCallback(() => {
    setErrors(prev => prev.filter(e => !e.resolved));
  }, []);

  const getErrorsBySource = useCallback((source: ErrorSource) => {
    return errors.filter(e => e.source === source);
  }, [errors]);

  const getErrorsBySeverity = useCallback((severity: ErrorSeverity) => {
    return errors.filter(e => e.severity === severity);
  }, [errors]);

  const getUnresolvedCount = useCallback(() => {
    return errors.filter(e => !e.resolved).length;
  }, [errors]);

  // Export errors as JSON
  const exportErrors = useCallback(() => {
    const dataStr = JSON.stringify(errors, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fall-detection-errors-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [errors]);

  // Copy error to clipboard
  const copyError = useCallback(async (id: string) => {
    const error = errors.find(e => e.id === id);
    if (error) {
      await navigator.clipboard.writeText(JSON.stringify(error, null, 2));
      return true;
    }
    return false;
  }, [errors]);

  return {
    // State
    errors,
    // Trackers
    trackError,
    trackInfo,
    trackWarning,
    trackErrorDirect: trackErrorFn,
    trackCritical,
    // Actions
    resolveError,
    clearErrors,
    clearResolved,
    // Queries
    getErrorsBySource,
    getErrorsBySeverity,
    getUnresolvedCount,
    // Utilities
    exportErrors,
    copyError,
  };
}

export default useErrorTracker;