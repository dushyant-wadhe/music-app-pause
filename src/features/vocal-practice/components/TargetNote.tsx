"use client";

import { useCallback, useRef } from "react";
import { midiToFreq, sargamDegreeToMidi, NATURAL_SWARAS } from "../utils/sargamPitch";
import { cn } from "@/lib/cn";
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
    <div className="flex flex-wrap items-center gap-1.5 bg-[#3d200d] p-0.5 rounded border border-[#2a1405] h-7">
      <span className="text-[9px] font-bold text-[#fcd34d] uppercase tracking-wider px-1">
        Target
      </span>

      {/* Swara button pills */}
      <div className="flex items-center gap-0.5">
        {NATURAL_SWARAS.map((swara) => {
          const isSelected = selectedDegree === swara.degree;
          return (
            <button
              key={swara.degree}
              onClick={() => {
                onSelectDegree(swara.degree);
                playReference(swara.degree);
              }}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5 flex items-center justify-center select-none",
                isSelected
                  ? "bg-[#d97706] text-[#fdf6e2] border-[#b45309] font-extrabold shadow-sm"
                  : "bg-transparent text-[#fcd34d]/80 border-transparent hover:bg-[#5c3a21]"
              )}
            >
              {swara.label}
            </button>
          );
        })}
      </div>

      {/* Play Reference Tone Icon */}
      {selectedDegree !== null && (
        <button
          onClick={() => playReference(selectedDegree)}
          className="h-5 w-5 rounded bg-[#5c3a21] hover:bg-[#784928] text-[#fcd34d] flex items-center justify-center transition-colors cursor-pointer border border-[#2a1405] ml-0.5"
          title="Play Reference Tone"
          aria-label="Play reference tone"
        >
          <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="currentColor">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </button>
      )}
    </div>
  );
}
