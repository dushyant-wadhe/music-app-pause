"use client";

import { useCallback, useRef } from "react";
import { midiToFreq, sargamDegreeToMidi, NATURAL_SWARAS } from "../utils/sargamPitch";
import type { RootNote } from "@/types";

interface TargetNoteProps {
  rootNote: RootNote;
  octave: number;
  selectedDegree: number | null;
  onSelectDegree: (degree: number) => void;
}

export function TargetNote({ rootNote, octave, selectedDegree, onSelectDegree }: TargetNoteProps) {
  const ctxRef = useRef<AudioContext | null>(null);

  const playReference = useCallback((degree: number) => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    const midi = sargamDegreeToMidi(degree, rootNote, octave);
    const freq = midiToFreq(midi);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.015);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.85);
  }, [rootNote, octave]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mr-1">
        Target Swar:
      </span>

      {/* Inline swara button capsules */}
      <div className="flex items-center gap-1">
        {NATURAL_SWARAS.map((swara) => {
          const isSelected = selectedDegree === swara.degree;
          return (
            <button
              key={swara.degree}
              onClick={() => {
                onSelectDegree(swara.degree);
                playReference(swara.degree);
              }}
              className="flex h-7 px-2.5 items-center justify-center rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              style={{
                background: isSelected ? "var(--accent-700)" : "var(--surface-soft)",
                color: isSelected ? "#fffdf9" : "var(--app-fg)",
                border: isSelected ? "none" : "1.5px solid var(--card-border)",
              }}
            >
              {swara.label}
            </button>
          );
        })}
      </div>

      {/* Compact play button next to it */}
      {selectedDegree !== null && (
        <button
          onClick={() => playReference(selectedDegree)}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-95 cursor-pointer"
          style={{
            background: "var(--surface-soft)",
            border: "1.5px solid var(--card-border)",
            color: "var(--accent-700)",
          }}
          title="Play Reference Tone"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </button>
      )}
    </div>
  );
}
