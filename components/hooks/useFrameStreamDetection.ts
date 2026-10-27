"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DetectionResult {
  boxes: number[][];
  scores: number[];
  falls: boolean[];
  /** Unix timestamp in seconds. */
  timestamp: number;
  /** Frame sequence number for ordering. */
  frame_index: number;
  /** Whether fall alert email was successfully sent by backend. */
  email_sent?: boolean;
}

export interface UseFrameStreamDetectionOptions {
  /** WebSocket endpoint that accepts JSON { image, conf_threshold, frame_index, timestamp }. */
  wsUrl: string;
  onFrameResult?: (result: DetectionResult) => void;
  onFrameError?: (frameIndex: number, error: Error) => void;
  onFallDetected?: (score: number, frameIndex: number, emailSent: boolean) => void;
  confThreshold?: number;
}

export interface UseFrameStreamDetectionReturn {
  isDetecting: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  detections: DetectionResult | null;
  error: string | null;
  framesSent: number;
  framesReceived: number;
  lastSent: number | null;
  lastReceived: number | null;
  wsStatus: "CLOSED" | "CONNECTING" | "OPEN" | "CLOSING";
  confThreshold: number;
  startDetection: (confThreshold?: number) => void;
  /** preserveState=true closes the socket without clearing the last results/counters. */
  stopDetection: (preserveState?: boolean) => void;
  setConfThreshold: (value: number) => void;
  /** Returns true only when the frame was actually sent. */
  sendFrame: (
    imageBase64: string,
    frameIndex: number,
    timestamp: number
  ) => boolean;
}

export function useFrameStreamDetection({
  wsUrl,
  onFrameResult,
  onFrameError,
  onFallDetected,
  confThreshold: initialConfThreshold = 0.6,
}: UseFrameStreamDetectionOptions): UseFrameStreamDetectionReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const connectWebSocketRef = useRef<() => void>(() => {});
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFallAlertRef = useRef(0);
  const isDetectingRef = useRef(false);
  const framePendingRef = useRef(false);
  const pendingFrameIndexRef = useRef<number | null>(null);
  const confThresholdRef = useRef(initialConfThreshold);
  const mountedRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const wsReadyRef = useRef(false);
  const callbacksRef = useRef({ onFrameResult, onFrameError, onFallDetected });

  useEffect(() => {
    callbacksRef.current = { onFrameResult, onFrameError, onFallDetected };
  }, [onFrameResult, onFrameError, onFallDetected]);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [detections, setDetections] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [framesSent, setFramesSent] = useState(0);
  const [framesReceived, setFramesReceived] = useState(0);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [lastReceived, setLastReceived] = useState<number | null>(null);
  const [wsStatus, setWsStatus] = useState<"CLOSED" | "CONNECTING" | "OPEN" | "CLOSING">("CLOSED");
  const [confThreshold, setConfThresholdState] = useState(initialConfThreshold);

  useEffect(() => {
    confThresholdRef.current = confThreshold;
  }, [confThreshold]);

  const clearResponseTimeout = useCallback(() => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }, []);

  const closeWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    clearResponseTimeout();

    const ws = wsRef.current;
    wsRef.current = null;
    wsReadyRef.current = false;
    framePendingRef.current = false;
    pendingFrameIndexRef.current = null;

    if (ws) {
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
      setIsConnecting(false);
      setWsStatus("CLOSED");
    }
  }, [clearResponseTimeout]);

  const connectWebSocket = useCallback(() => {
    if (!isDetectingRef.current) return;

    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (!wsUrl) {
      if (mountedRef.current) setError("WebSocket URL is missing.");
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
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useFrameStreamDetection] Could not create WebSocket:", err);
      if (mountedRef.current) {
        setError(`Could not create WebSocket connection: ${message}`);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isDetectingRef.current) connectWebSocketRef.current();
      }, 1500);
      return;
    }

    wsRef.current = ws;
    wsReadyRef.current = false;
    if (mountedRef.current) {
      setWsStatus("CONNECTING");
      setIsConnecting(true);
    }

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      wsReadyRef.current = true;
      console.info("[useFrameStreamDetection] WebSocket connected:", wsUrl);
      if (mountedRef.current) {
        setIsConnected(true);
        setIsConnecting(false);
        setWsStatus("OPEN");
        setError(null);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (wsRef.current !== ws) return;

      let data: any;
      try {
        data = JSON.parse(String(event.data));
      } catch (err) {
        console.error("[useFrameStreamDetection] Invalid JSON response:", event.data, err);
        if (mountedRef.current) {
          setError("The detection server returned invalid JSON.");
        }
        // Do not leave the sender locked if the server sent a non-JSON response.
        const badFrameIndex = pendingFrameIndexRef.current;
        framePendingRef.current = false;
        pendingFrameIndexRef.current = null;
        clearResponseTimeout();
        if (badFrameIndex !== null) {
          callbacksRef.current.onFrameError?.(badFrameIndex, new Error("The detection server returned invalid JSON."));
        }
        return;
      }

      // If the backend reports an error, release the pending frame so processing
      // can decide whether to continue or stop.
      if (data?.error) {
        const failedFrameIndex = pendingFrameIndexRef.current;
        framePendingRef.current = false;
        pendingFrameIndexRef.current = null;
        clearResponseTimeout();
        console.error("[useFrameStreamDetection] Backend error:", data.error);
        if (mountedRef.current) setError(String(data.error));
        if (failedFrameIndex !== null) {
          callbacksRef.current.onFrameError?.(failedFrameIndex, new Error(String(data.error)));
        }
        return;
      }

      // Some backends send status/ack messages before the actual detection result.
      // Only treat messages with detection fields as completed frame responses.
      const payload = data?.result && typeof data.result === "object"
        ? data.result
        : data?.detection && typeof data.detection === "object"
          ? data.detection
          : data;
      const hasDetectionPayload =
        Array.isArray(payload?.boxes) ||
        Array.isArray(payload?.scores) ||
        Array.isArray(payload?.falls);

      if (!hasDetectionPayload) {
        console.debug("[useFrameStreamDetection] Ignoring non-detection message:", data);
        return;
      }

      const respondedFrameIndex = pendingFrameIndexRef.current;
      framePendingRef.current = false;
      pendingFrameIndexRef.current = null;
      clearResponseTimeout();

      const boxes = Array.isArray(payload?.boxes) ? payload.boxes : [];
      const scores = Array.isArray(payload?.scores) ? payload.scores.map(Number) : [];
      const falls = Array.isArray(payload?.falls) ? payload.falls.map(Boolean) : [];
      const emailSent = Boolean(payload?.email_sent);
      const rawTimestamp = payload?.timestamp == null ? Number.NaN : Number(payload.timestamp);
      const timestamp = Number.isFinite(rawTimestamp)
        ? (rawTimestamp > 1e12 ? rawTimestamp / 1000 : rawTimestamp)
        : Date.now() / 1000;
      const rawFrameIndex = payload?.frame_index ?? data?.frame_index;
      const parsedIndex = rawFrameIndex == null ? Number.NaN : Number(rawFrameIndex);
      const frameIndex = Number.isFinite(parsedIndex)
        ? parsedIndex
        : (respondedFrameIndex ?? -1);

      const result: DetectionResult = {
        boxes,
        scores,
        falls,
        timestamp,
        frame_index: frameIndex,
        email_sent: emailSent,
      };

      if (mountedRef.current) {
        setDetections(result);
        setFramesReceived((count) => count + 1);
        setLastReceived(Date.now());
        setError(null);
      }

      callbacksRef.current.onFrameResult?.(result);

      const fallIndex = result.falls.findIndex(Boolean);
      if (fallIndex !== -1 && callbacksRef.current.onFallDetected) {
        const now = Date.now();
        if (now - lastFallAlertRef.current >= 2000) {
          lastFallAlertRef.current = now;
          callbacksRef.current.onFallDetected(Number(result.scores[fallIndex]) || 0, frameIndex, result.email_sent ?? false);
        }
      }
    };

    ws.onerror = (event) => {
      console.error("[useFrameStreamDetection] WebSocket error:", event);
      if (mountedRef.current) {
        setError("WebSocket connection error. Check the URL and backend logs.");
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      wsReadyRef.current = false;
      const interruptedFrameIndex = pendingFrameIndexRef.current;
      framePendingRef.current = false;
      pendingFrameIndexRef.current = null;
      clearResponseTimeout();
      if (interruptedFrameIndex !== null && isDetectingRef.current && !intentionalCloseRef.current) {
        callbacksRef.current.onFrameError?.(interruptedFrameIndex, new Error("WebSocket closed before the detection result arrived."));
      }

      if (mountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        setWsStatus("CLOSED");
      }
      console.warn(
        "[useFrameStreamDetection] WebSocket closed:",
        event.code,
        event.reason || "no reason provided"
      );

      if (isDetectingRef.current && !intentionalCloseRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isDetectingRef.current && !intentionalCloseRef.current) {
            connectWebSocketRef.current();
          }
        }, 1000);
      }
    };
  }, [wsUrl, clearResponseTimeout]);

  connectWebSocketRef.current = connectWebSocket;

  const sendFrame = useCallback(
    (imageBase64: string, frameIndex: number, timestamp: number): boolean => {
      if (!isDetectingRef.current || !wsReadyRef.current) return false;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        wsReadyRef.current = false;
        return false;
      }
      if (framePendingRef.current) return false;

      framePendingRef.current = true;
      pendingFrameIndexRef.current = frameIndex;

      try {
        ws.send(
          JSON.stringify({
            image: imageBase64,
            conf_threshold: confThresholdRef.current,
            frame_index: frameIndex,
            timestamp,
          })
        );

        if (mountedRef.current) {
          setFramesSent((count) => count + 1);
          setLastSent(Date.now());
        }

        clearResponseTimeout();
        responseTimeoutRef.current = setTimeout(() => {
          if (!framePendingRef.current) return;

          const pendingIndex = pendingFrameIndexRef.current;
          framePendingRef.current = false;
          pendingFrameIndexRef.current = null;
          responseTimeoutRef.current = null;

          const message = `No detection response received for frame ${pendingIndex ?? frameIndex}.`;
          console.error("[useFrameStreamDetection]", message);
          if (mountedRef.current) setError(message);
          callbacksRef.current.onFrameError?.(
            pendingIndex ?? frameIndex,
            new Error(message)
          );
        }, 10000);

        return true;
      } catch (err) {
        framePendingRef.current = false;
        pendingFrameIndexRef.current = null;
        clearResponseTimeout();

        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[useFrameStreamDetection] Failed to send frame:", error);
        if (mountedRef.current) setError("Failed to send a frame to the detection server.");
        callbacksRef.current.onFrameError?.(frameIndex, error);
        return false;
      }
    },
    [clearResponseTimeout]
  );

  const startDetection = useCallback(
    (nextThreshold?: number) => {
      if (isDetectingRef.current) return;

      setError(null);
      setDetections(null);
      setFramesSent(0);
      setFramesReceived(0);
      setLastSent(null);
      setLastReceived(null);
      framePendingRef.current = false;
      pendingFrameIndexRef.current = null;
      clearResponseTimeout();

      intentionalCloseRef.current = false;
      wsReadyRef.current = false;

      if (nextThreshold !== undefined) {
        confThresholdRef.current = nextThreshold;
        setConfThresholdState(nextThreshold);
      }

      isDetectingRef.current = true;
      setIsDetecting(true);
      connectWebSocketRef.current();
    },
    [clearResponseTimeout]
  );

  const stopDetection = useCallback(
    (preserveState = false) => {
      isDetectingRef.current = false;
      intentionalCloseRef.current = true;
      closeWebSocket();

      if (mountedRef.current) {
        setIsDetecting(false);
        if (!preserveState) {
          setDetections(null);
          setFramesSent(0);
          setFramesReceived(0);
          setLastSent(null);
          setLastReceived(null);
        }
      }
    },
    [closeWebSocket]
  );

  const setConfThreshold = useCallback((value: number) => {
    confThresholdRef.current = value;
    setConfThresholdState(value);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isDetectingRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };
  }, []);

  return {
    isDetecting,
    isConnected,
    isConnecting,
    detections,
    error,
    framesSent,
    framesReceived,
    lastSent,
    lastReceived,
    wsStatus,
    confThreshold,
    startDetection,
    stopDetection,
    setConfThreshold,
    sendFrame,
  };
}

export default useFrameStreamDetection;
