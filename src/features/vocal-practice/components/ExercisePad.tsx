"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { EXERCISES, type Exercise } from "../utils/exercises";
import { midiToFreq, sargamDegreeToMidi } from "../utils/sargamPitch";
import type { RootNote } from "@/types";

interface ExercisePadProps {
  rootNote: RootNote;
  octave: number;
  detectedSargam: string | null;
  onNoteAttempt: (hit: boolean) => void;
}

const CATEGORY_LABELS: Record<Exercise["category"], string> = {
  aaroha: "Aaroha",
  avaroha: "Avaroha",
  alankar: "Alankar",
  raga: "Raga",
};

export function ExercisePad({ rootNote, octave, detectedSargam, onNoteAttempt }: ExercisePadProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [noteIndex, setNoteIndex] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdCountRef = useRef(0);
  const oscCtxRef = useRef<AudioContext | null>(null);
  const noteIndexRef = useRef(0);
  const isRunningRef = useRef(false);

  const selectedExercise = EXERCISES.find((e) => e.id === selectedId) ?? null;
  const selectedExerciseRef = useRef<typeof selectedExercise>(null);

  useEffect(() => {
    selectedExerciseRef.current = selectedExercise;
  }, [selectedExercise]);

  const playTone = useCallback((degree: number, octaveOffset = 0) => {
    if (!oscCtxRef.current || oscCtxRef.current.state === "closed") {
      oscCtxRef.current = new AudioContext();
    }
    const ctx = oscCtxRef.current;
    const midi = sargamDegreeToMidi(degree, rootNote, octave + octaveOffset);
    const freq = midiToFreq(midi);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  }, [rootNote, octave]);

  const stopExercise = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isRunningRef.current = false;
    noteIndexRef.current = 0;
    holdCountRef.current = 0;
    setIsRunning(false);
    setNoteIndex(0);
  }, []);

  const advanceNote = useCallback(() => {
    const exercise = selectedExerciseRef.current;
    if (!exercise) return;
    const next = noteIndexRef.current + 1;
    if (next >= exercise.notes.length) {
      stopExercise();
    } else {
      noteIndexRef.current = next;
      setNoteIndex(next);
      const nextNote = exercise.notes[next];
      if (nextNote) playTone(nextNote.degree, nextNote.octaveOffset ?? 0);
    }
  }, [stopExercise, playTone]);

  const startExercise = useCallback((exercise: Exercise) => {
    stopExercise();
    noteIndexRef.current = 0;
    holdCountRef.current = 0;
    isRunningRef.current = true;
    setNoteIndex(0);
    setIsRunning(true);
    const first = exercise.notes[0];
    if (first) playTone(first.degree, first.octaveOffset ?? 0);
  }, [stopExercise, playTone]);

  // Detect hold and advance note — uses refs to avoid setState-in-effect
  useEffect(() => {
    if (!isRunning || !selectedExercise) return;
    const current = selectedExercise.notes[noteIndexRef.current];
    if (!current) return;

    const isHit = detectedSargam &&
      (detectedSargam === current.label || detectedSargam.startsWith(current.label.charAt(0)));

    if (isHit) {
      holdCountRef.current++;
      if (holdCountRef.current >= 8) {
        holdCountRef.current = 0;
        onNoteAttempt(true);
        advanceNote();
      }
    } else {
      holdCountRef.current = Math.max(0, holdCountRef.current - 1);
    }
  // detectedSargam change is the primary trigger; other deps are stable refs/callbacks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedSargam, noteIndex, isRunning]);

  useEffect(() => {
    return () => stopExercise();
  }, [stopExercise]);

  const currentNote = selectedExercise?.notes[noteIndex] ?? null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--card-bg)", border: "1.5px solid var(--card-border)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--ink-soft)" }}>
        Sargam Exercises
      </p>

      {/* Exercise cards */}
      <div className="grid grid-cols-2 gap-2 mb-4 md:grid-cols-3">
        {EXERCISES.map((ex) => {
          const active = selectedId === ex.id;
          return (
            <button
              key={ex.id}
              onClick={() => {
                if (active && isRunning) {
                  stopExercise();
                } else {
                  setSelectedId(ex.id);
                  startExercise(ex);
                }
              }}
              className="text-left rounded-xl p-3 transition-all active:scale-95"
              style={{
                background: active ? "var(--accent-700)" : "var(--surface-soft)",
                border: active ? "none" : "1.5px solid var(--card-border)",
                color: active ? "#fffdf9" : "var(--app-fg)",
              }}
            >
              <div className="font-semibold text-sm leading-snug">
                {ex.name}
                {ex.nameHindi && (
                  <span className="ml-1.5 opacity-60 text-xs" style={{ fontFamily: "sans-serif" }}>
                    {ex.nameHindi}
                  </span>
                )}
              </div>
              <div
                className="text-[10px] mt-0.5 uppercase tracking-wide"
                style={{ opacity: 0.65 }}
              >
                {CATEGORY_LABELS[ex.category]} · {ex.tempoBpm} bpm
              </div>
            </button>
          );
        })}
      </div>

      {/* Active exercise note track */}
      {selectedExercise && (
        <div
          className="rounded-xl p-3"
          style={{ background: "var(--surface-muted)", border: "1px solid var(--card-border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
              {isRunning ? `Note ${noteIndex + 1} / ${selectedExercise.notes.length}` : "Ready"}
            </span>
            {isRunning && (
              <button
                onClick={stopExercise}
                className="text-xs px-2 py-0.5 rounded-lg"
                style={{
                  background: "var(--surface-soft)",
                  border: "1px solid var(--card-border)",
                  color: "var(--ink-soft)",
                }}
              >
                Stop
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedExercise.notes.map((note, idx) => {
              const isPast = isRunning && idx < noteIndex;
              const isCurrent = isRunning && idx === noteIndex;
              const isFuture = isRunning && idx > noteIndex;
              return (
                <span
                  key={idx}
                  className="inline-flex items-center justify-center rounded-lg text-xs font-semibold"
                  style={{
                    width: "2.4rem",
                    height: "2rem",
                    background: isCurrent
                      ? "var(--accent-700)"
                      : isPast
                      ? "rgba(90,160,100,0.2)"
                      : "var(--card-bg)",
                    color: isCurrent
                      ? "#fffdf9"
                      : isPast
                      ? "#3a7a44"
                      : isFuture
                      ? "var(--ink-soft)"
                      : "var(--app-fg)",
                    border: isCurrent
                      ? "none"
                      : "1px solid var(--card-border)",
                    opacity: !isRunning ? 0.8 : isFuture ? 0.5 : 1,
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  {note.label}
                </span>
              );
            })}
          </div>
          {currentNote && isRunning && (
            <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
              Sing <strong style={{ color: "var(--accent-700)" }}>{currentNote.label}</strong> and hold…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
