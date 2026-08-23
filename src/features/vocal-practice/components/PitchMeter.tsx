"use client";

import { type PitchState } from "../hooks/usePitchDetector";

interface PitchMeterProps {
  pitch: PitchState;
}

const COLOUR = {
  flat:  { bg: "rgba(120,140,200,0.12)", needle: "#7a9ad4", label: "#4a6aaa" },
  sharp: { bg: "rgba(200,130,70,0.12)",  needle: "#d4874a", label: "#b0621a" },
  on:    { bg: "rgba(90,160,100,0.14)",  needle: "#5aa064", label: "#3a7a44" },
  idle:  { bg: "rgba(0,0,0,0.04)",       needle: "#c8b89a", label: "#a09070" },
};

function formatCents(cents: number): string {
  if (cents === 0) return "±0¢";
  return cents > 0 ? `+${cents}¢` : `${cents}¢`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export { formatDuration };

export function PitchMeter({ pitch }: PitchMeterProps) {
  const { noteInfo, cents, accuracy, isListening, frequency } = pitch;

  const state = !isListening ? "idle" : (accuracy ?? "idle");
  const col = COLOUR[state] ?? COLOUR.idle;

  // Needle position: -50..+50 cents → 0%..100% of width
  // Clamp to ±50
  const clamped = Math.max(-50, Math.min(50, cents));
  const needlePct = ((clamped + 50) / 100) * 100;

  const sargamLabel = noteInfo?.sargam ?? "—";
  const westernLabel = noteInfo ? `${noteInfo.westernName}${noteInfo.octave}` : "";
  const freqLabel = frequency ? `${frequency.toFixed(1)} Hz` : "";

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-5"
      style={{
        background: "var(--card-bg)",
        border: "1.5px solid var(--card-border)",
        transition: "background 0.3s",
      }}
    >
      {/* Note name */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <div
            className="leading-none"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "clamp(3rem, 10vw, 5rem)",
              fontWeight: 600,
              color: col.label,
              transition: "color 0.25s",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            {sargamLabel}
          </div>
          {westernLabel && (
            <div className="mt-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
              {westernLabel}
            </div>
          )}
        </div>

        <div className="text-right">
          {isListening && noteInfo && (
            <>
              <div
                className="text-sm font-semibold"
                style={{ color: col.label, transition: "color 0.25s" }}
              >
                {accuracy === "on"
                  ? "In tune ✓"
                  : accuracy === "flat"
                  ? "▼ Flat"
                  : "▲ Sharp"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {formatCents(cents)}
              </div>
              {freqLabel && (
                <div className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--ink-soft)", opacity: 0.7 }}>
                  {freqLabel}
                </div>
              )}
            </>
          )}
          {!isListening && (
            <div className="text-xs" style={{ color: "var(--ink-soft)" }}>
              Mic off
            </div>
          )}
        </div>
      </div>

      {/* Gauge track */}
      <div className="relative h-3 w-full rounded-full overflow-hidden"
        style={{ background: "var(--surface-muted)" }}
      >
        {/* Coloured fill from center to needle */}
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: cents < 0 ? `${needlePct}%` : "50%",
            right: cents > 0 ? `${100 - needlePct}%` : "50%",
            background: col.needle,
            transition: "left 0.1s, right 0.1s, background 0.25s",
          }}
        />
        {/* Center tick */}
        <div
          className="absolute inset-y-0 w-[2px]"
          style={{ left: "50%", transform: "translateX(-50%)", background: "var(--card-border)" }}
        />
        {/* Needle */}
        <div
          className="absolute top-0 h-full w-[3px] rounded-full"
          style={{
            left: `${needlePct}%`,
            transform: "translateX(-50%)",
            background: col.needle,
            transition: "left 0.08s, background 0.25s",
            boxShadow: `0 0 4px ${col.needle}88`,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px]" style={{ color: "var(--ink-soft)", opacity: 0.6 }}>
        <span>Flat ▼</span>
        <span>In tune</span>
        <span>▲ Sharp</span>
      </div>
    </div>
  );
}
