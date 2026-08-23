"use client";

import { formatDuration } from "./PitchMeter";
import type { SessionStats } from "../hooks/useVocalSession";

interface SessionPanelProps {
  isActive: boolean;
  stats: SessionStats;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 flex-1 min-w-0"
      style={{ background: "var(--surface-soft)", border: "1px solid var(--card-border)" }}
    >
      <div className="text-base font-semibold leading-none" style={{ color: "var(--accent-700)" }}>
        {value}
      </div>
      <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
        {label}
      </div>
    </div>
  );
}

export function SessionPanel({ isActive, stats, onStart, onStop, onReset }: SessionPanelProps) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--card-bg)", border: "1.5px solid var(--card-border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
          Session
        </p>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#c0392b" }}>
              <span
                className="h-2 w-2 rounded-full inline-block"
                style={{
                  background: "#c0392b",
                  animation: "pulse 1.2s ease-in-out infinite",
                }}
              />
              REC
            </span>
          )}
          {stats.notesAttempted > 0 && !isActive && (
            <button
              onClick={onReset}
              className="text-xs px-2 py-0.5 rounded-lg transition-colors"
              style={{
                color: "var(--ink-soft)",
                background: "var(--surface-soft)",
                border: "1px solid var(--card-border)",
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 mb-4">
        <StatPill label="Duration" value={formatDuration(stats.durationSeconds)} />
        <StatPill label="Attempts" value={String(stats.notesAttempted)} />
        <StatPill label="Hit" value={String(stats.notesHit)} />
        <StatPill label="Accuracy" value={stats.notesAttempted > 0 ? `${stats.accuracyPercent}%` : "—"} />
      </div>

      {/* Start / Stop */}
      <button
        onClick={isActive ? onStop : onStart}
        className="w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]"
        style={{
          background: isActive ? "#b9382f" : "var(--accent-700)",
          color: "#fffdf9",
          border: "none",
          letterSpacing: "0.02em",
        }}
      >
        {isActive ? "■  End Session" : "▶  Start Session"}
      </button>
    </div>
  );
}
