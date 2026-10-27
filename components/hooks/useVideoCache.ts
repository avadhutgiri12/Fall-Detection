"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CachedVideoChunk {
  id: string;
  sessionId: string;
  chunkIndex: number;
  frames: Array<{
    index: number;
    blob: Blob;
    timestamp: number;
  }>;
  results?: Array<{
    boxes: number[][];
    scores: number[];
    falls: boolean[];
    timestamp: number;
  }>;
  createdAt: number;
  processedAt?: number;
}

export interface CachedVideoSession {
  id: string;
  videoName: string;
  videoSize: number;
  videoType: string;
  totalChunks: number;
  chunkSize: number;
  createdAt: number;
  completedAt?: number;
  status: "pending" | "processing" | "completed" | "failed";
}

const DB_NAME = "FallDetectionVideoCache";
const DB_VERSION = 1;
const CHUNK_STORE = "chunks";
const SESSION_STORE = "sessions";

let dbPromise: Promise<IDBDatabase> | null = null;

function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
        chunkStore.createIndex("sessionId", "sessionId", { unique: false });
        chunkStore.createIndex("chunkIndex", "chunkIndex", { unique: false });
      }

      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const sessionStore = db.createObjectStore(SESSION_STORE, { keyPath: "id" });
        sessionStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });

  return dbPromise;
}

export function useVideoCache() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  // Initialize DB on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    initDB()
      .then(() => setIsReady(true))
      .catch((err) => {
        console.warn("[useVideoCache] IndexedDB init failed:", err);
        setError(err.message);
        setIsReady(true); // Allow fallback to in-memory
      });
  }, []);

  // Generate unique ID
  const generateId = useCallback(() => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, []);

  // Save a video session
  const saveSession = useCallback(
    async (session: Omit<CachedVideoSession, "id" | "createdAt">): Promise<string> => {
      const db = await initDB();
      const id = generateId();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(SESSION_STORE, "readwrite");
        const store = transaction.objectStore(SESSION_STORE);

        const sessionData: CachedVideoSession = {
          ...session,
          id,
          createdAt: Date.now(),
        };

        const request = store.add(sessionData);
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
      });
    },
    [generateId]
  );

  // Get session by ID
  const getSession = useCallback(async (id: string): Promise<CachedVideoSession | null> => {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, "readonly");
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }, []);

  // Update session
  const updateSession = useCallback(async (session: CachedVideoSession): Promise<void> => {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, "readwrite");
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  // Get all sessions for current user
  const getAllSessions = useCallback(async (): Promise<CachedVideoSession[]> => {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, "readonly");
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
      request.onerror = () => reject(request.error);
    });
  }, []);

  // Delete session and all its chunks
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    const db = await initDB();

    // Delete chunks first
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CHUNK_STORE, "readwrite");
      const store = transaction.objectStore(CHUNK_STORE);
      const index = store.index("sessionId");
      const request = index.getAllKeys(sessionId);

      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach((key) => store.delete(key));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    // Delete session
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, "readwrite");
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.delete(sessionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  // Save chunk
  const saveChunk = useCallback(
    async (chunk: Omit<CachedVideoChunk, "id" | "createdAt">): Promise<string> => {
      const db = await initDB();
      const id = generateId();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHUNK_STORE, "readwrite");
        const store = transaction.objectStore(CHUNK_STORE);

        const chunkData: CachedVideoChunk = {
          ...chunk,
          id,
          createdAt: Date.now(),
        };

        const request = store.add(chunkData);
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
      });
    },
    [generateId]
  );

  // Get chunk by session and index
  const getChunk = useCallback(
    async (sessionId: string, chunkIndex: number): Promise<CachedVideoChunk | null> => {
      const db = await initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHUNK_STORE, "readonly");
        const store = transaction.objectStore(CHUNK_STORE);
        const index = store.index("sessionId");
        const request = index.getAll(IDBKeyRange.only(sessionId));

        request.onsuccess = () => {
          const chunks = request.result.filter((c) => c.chunkIndex === chunkIndex);
          resolve(chunks[0] || null);
        };
        request.onerror = () => reject(request.error);
      });
    },
    []
  );

  // Get all chunks for a session
  const getChunksForSession = useCallback(
    async (sessionId: string): Promise<CachedVideoChunk[]> => {
      const db = await initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHUNK_STORE, "readonly");
        const store = transaction.objectStore(CHUNK_STORE);
        const index = store.index("sessionId");
        const request = index.getAll(IDBKeyRange.only(sessionId));

        request.onsuccess = () => {
          const chunks = request.result.sort((a, b) => a.chunkIndex - b.chunkIndex);
          resolve(chunks);
        };
        request.onerror = () => reject(request.error);
      });
    },
    []
  );

  // Update chunk with results
  const updateChunkResults = useCallback(
    async (
      sessionId: string,
      chunkIndex: number,
      results: CachedVideoChunk["results"]
    ): Promise<void> => {
      const chunk = await getChunk(sessionId, chunkIndex);
      if (!chunk) return;

      chunk.results = results;
      chunk.processedAt = Date.now();

      const db = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHUNK_STORE, "readwrite");
        const store = transaction.objectStore(CHUNK_STORE);
        const request = store.put(chunk);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    [getChunk]
  );

  // Clear all cache for a session
  const clearSessionCache = useCallback(
    async (sessionId: string): Promise<void> => {
      await deleteSession(sessionId);
    },
    [deleteSession]
  );

  // Clear all cache (for cleanup on refresh)
  const clearAllCache = useCallback(async (): Promise<void> => {
    const db = await initDB();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([CHUNK_STORE, SESSION_STORE], "readwrite");
      const chunkStore = transaction.objectStore(CHUNK_STORE);
      const sessionStore = transaction.objectStore(SESSION_STORE);

      let completed = 0;
      const checkDone = () => {
        completed++;
        if (completed === 2) resolve();
      };

      const chunkRequest = chunkStore.clear();
      chunkRequest.onsuccess = checkDone;
      chunkRequest.onerror = () => reject(chunkRequest.error);

      const sessionRequest = sessionStore.clear();
      sessionRequest.onsuccess = checkDone;
      sessionRequest.onerror = () => reject(sessionRequest.error);
    });
  }, []);

  // Get cache stats
  const getCacheStats = useCallback(async (): Promise<{
    totalSessions: number;
    totalChunks: number;
    estimatedSize: number;
  }> => {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CHUNK_STORE, SESSION_STORE], "readonly");
      const chunkStore = transaction.objectStore(CHUNK_STORE);
      const sessionStore = transaction.objectStore(SESSION_STORE);

      const chunkRequest = chunkStore.count();
      const sessionRequest = sessionStore.count();

      Promise.all([
        new Promise<number>((res, rej) => {
          chunkRequest.onsuccess = () => res(chunkRequest.result);
          chunkRequest.onerror = () => rej(chunkRequest.error);
        }),
        new Promise<number>((res, rej) => {
          sessionRequest.onsuccess = () => res(sessionRequest.result);
          sessionRequest.onerror = () => rej(sessionRequest.error);
        }),
      ])
        .then(([totalChunks, totalSessions]) => {
          // Rough estimate: ~100KB per chunk
          resolve({
            totalSessions,
            totalChunks,
            estimatedSize: totalChunks * 100 * 1024,
          });
        })
        .catch(reject);
    });
  }, []);

  return {
    isReady,
    error,
    // Session operations
    saveSession,
    getSession,
    updateSession,
    getAllSessions,
    deleteSession,
    // Chunk operations
    saveChunk,
    getChunk,
    getChunksForSession,
    updateChunkResults,
    // Cleanup
    clearSessionCache,
    clearAllCache,
    // Stats
    getCacheStats,
  };
}

export default useVideoCache;