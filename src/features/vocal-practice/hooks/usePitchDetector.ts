"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getUserMicStream,
  createPitchDetector,
  detectPitch,
  type PitchDetectorHandle,
} from "../engine/pitchDetector";
import {
  freqToMidi,
  midiToNoteInfo,
  centsDeviation,
  pitchLabel,
  type NoteInfo,
} from "../utils/sargamPitch";
import type { RootNote } from "@/types";

export type MicPermission = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export interface PitchState {
  noteInfo: NoteInfo | null;
  cents: number;
  accuracy: "flat" | "sharp" | "on" | null;
  isListening: boolean;
  frequency: number | null;       // raw Hz
  smoothedFrequency: number | null; // EMA-smoothed Hz for graph
  clarity: number;
}

// Exponential moving average coefficient — lower = smoother but slower response
// 0.25 → strong smoothing; good balance of voice glide vs. responsiveness
const EMA_ALPHA = 0.25;

// How many consecutive silent frames before clearing the display note
const SILENCE_HOLDOFF_FRAMES = 6; // ~360ms at 60ms interval

export function usePitchDetector(rootNote: RootNote = "C") {
  const [permission, setPermission] = useState<MicPermission>("idle");
  const [pitch, setPitch] = useState<PitchState>({
    noteInfo: null,
    cents: 0,
    accuracy: null,
    isListening: false,
    frequency: null,
    smoothedFrequency: null,
    clarity: 0,
  });

  const handleRef = useRef<PitchDetectorHandle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootNoteRef = useRef<RootNote>(rootNote);

  // Smoothing state — kept in refs to avoid re-creating the interval
  const smoothedMidiRef = useRef<number | null>(null);
  const silenceCountRef = useRef(0);

  useEffect(() => {
    rootNoteRef.current = rootNote;
  }, [rootNote]);

  const stopListening = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (handleRef.current) {
      handleRef.current.stop(); // disconnects nodes, stops tracks, closes AudioContext
      handleRef.current = null;
    }
    smoothedMidiRef.current = null;
    silenceCountRef.current = 0;
    setPitch({
      noteInfo: null,
      cents: 0,
      accuracy: null,
      isListening: false,
      frequency: null,
      smoothedFrequency: null,
      clarity: 0,
    });
  }, []);

  const startListening = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      return;
    }
    if (handleRef.current) return; // already running

    setPermission("requesting");
    try {
      const stream = await getUserMicStream();
      setPermission("granted");
      const handle = createPitchDetector(stream);
      handleRef.current = handle;
      smoothedMidiRef.current = null;
      silenceCountRef.current = 0;

      setPitch((prev) => ({ ...prev, isListening: true }));

      intervalRef.current = setInterval(() => {
        if (!handleRef.current) return;
        const result = detectPitch(handleRef.current.analyser);

        if (!result) {
          // Hysteresis: don't instantly clear — hold for SILENCE_HOLDOFF_FRAMES
          silenceCountRef.current++;
          if (silenceCountRef.current >= SILENCE_HOLDOFF_FRAMES) {
            smoothedMidiRef.current = null;
            setPitch((prev) => ({
              ...prev,
              noteInfo: null,
              cents: 0,
              accuracy: null,
              frequency: null,
              smoothedFrequency: null,
              clarity: 0,
            }));
          }
          return;
        }

        // Valid pitch — reset silence counter
        silenceCountRef.current = 0;

        const rawMidi = freqToMidi(result.frequency);

        // Exponential moving average on MIDI (linear domain, avoids log issues)
        if (smoothedMidiRef.current === null) {
          smoothedMidiRef.current = rawMidi;
        } else {
          // Detect octave jump (> 7 semitones suddenly) — don't smooth across it
          const diff = Math.abs(rawMidi - smoothedMidiRef.current);
          if (diff > 7) {
            smoothedMidiRef.current = rawMidi; // hard snap on large jump
          } else {
            smoothedMidiRef.current = EMA_ALPHA * rawMidi + (1 - EMA_ALPHA) * smoothedMidiRef.current;
          }
        }

        const smoothedMidi = smoothedMidiRef.current;
        const smoothedFreq = 440 * Math.pow(2, (smoothedMidi - 69) / 12);

        // Note info uses smoothed MIDI for stable display
        const cents = centsDeviation(smoothedMidi);
        const noteInfo = midiToNoteInfo(smoothedMidi, rootNoteRef.current);
        const accuracy = pitchLabel(cents);

        setPitch({
          noteInfo,
          cents,
          accuracy,
          isListening: true,
          frequency: result.frequency,       // raw, for graph history (authentic movement)
          smoothedFrequency: smoothedFreq,   // smoothed, for graph curve drawing
          clarity: result.clarity,
        });
      }, 50); // 20fps — slightly faster for more responsive graph
    } catch {
      setPermission("denied");
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  return { pitch, permission, startListening, stopListening };
}
