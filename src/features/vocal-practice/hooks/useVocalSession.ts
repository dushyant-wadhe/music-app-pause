"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface SessionStats {
  durationSeconds: number;
  notesAttempted: number;
  notesHit: number;
  accuracyPercent: number;
}

export interface VocalSession {
  isActive: boolean;
  stats: SessionStats;
  startSession: () => void;
  stopSession: () => void;
  recordAttempt: (hit: boolean) => void;
  resetSession: () => void;
}

const EMPTY_STATS: SessionStats = {
  durationSeconds: 0,
  notesAttempted: 0,
  notesHit: 0,
  accuracyPercent: 0,
};

export function useVocalSession(): VocalSession {
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startSession = useCallback(() => {
    setStats(EMPTY_STATS);
    setIsActive(true);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        durationSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);
  }, []);

  const stopSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsActive(false);
  }, []);

  const recordAttempt = useCallback((hit: boolean) => {
    setStats((prev) => {
      const notesAttempted = prev.notesAttempted + 1;
      const notesHit = prev.notesHit + (hit ? 1 : 0);
      const accuracyPercent = notesAttempted > 0 ? Math.round((notesHit / notesAttempted) * 100) : 0;
      return { ...prev, notesAttempted, notesHit, accuracyPercent };
    });
  }, []);

  const resetSession = useCallback(() => {
    stopSession();
    setStats(EMPTY_STATS);
  }, [stopSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { isActive, stats, startSession, stopSession, recordAttempt, resetSession };
}
