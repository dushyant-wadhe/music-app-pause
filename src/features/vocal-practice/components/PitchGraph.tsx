"use client";

import { useEffect, useRef } from "react";
import { sargamDegreeToMidi, NATURAL_SWARAS, freqToMidi } from "../utils/sargamPitch";
import type { RootNote } from "@/types";

// ── Constants ────────────────────────────────────────────────────────────────
const GRAPH_HISTORY_MS = 14000; // 14 seconds visible window
const LABEL_W = 44;             // Left margin for swara labels

// Graph palette — dark studio feel
const C = {
  bg:           "#1e1a15",       // deep warm charcoal
  bgFade:       "#171310",       // slightly darker for gradient
  grid:         "rgba(255,240,200,0.065)", // subtle but visible
  gridSa:       "rgba(200,160,80,0.22)",   // visible anchor
  labelSa:      "rgba(210,170,90,0.75)",
  labelSwara:   "rgba(255,240,200,0.28)",
  target:       "rgba(178,123,53,0.85)",
  targetBand:   "rgba(178,123,53,0.06)",
  pitchAmber:   "#c8974a",       // pitch line — muted gold
  pitchGreen:   "#6aab72",       // on-target — warm sage green
  pitchGlow:    "rgba(200,151,74,0.18)",
  pitchGlowOn:  "rgba(106,171,114,0.22)",
  dot:          "#d4a84e",
  dotOn:        "#7bc484",
  idle:         "rgba(255,240,200,0.18)",
  silence:      "rgba(255,240,200,0.07)",
};

const ALL_SEMITONES = [
  { label: "Sa", degree: 0, isNatural: true },
  { label: "Re♭", degree: 1, isNatural: false },
  { label: "Re", degree: 2, isNatural: true },
  { label: "Ga♭", degree: 3, isNatural: false },
  { label: "Ga", degree: 4, isNatural: true },
  { label: "Ma", degree: 5, isNatural: true },
  { label: "Ma#", degree: 6, isNatural: false },
  { label: "Pa", degree: 7, isNatural: true },
  { label: "Dha♭", degree: 8, isNatural: false },
  { label: "Dha", degree: 9, isNatural: true },
  { label: "Ni♭", degree: 10, isNatural: false },
  { label: "Ni", degree: 11, isNatural: true },
];

interface PitchPoint {
  time: number;
  midi: number;       // smoothed MIDI for drawing
  rawMidi: number;    // raw MIDI (for gap detection)
}

interface PitchGraphProps {
  frequency: number | null;           // raw Hz
  smoothedFrequency: number | null;   // EMA-smoothed Hz
  targetDegree: number | null;
  rootNote: RootNote;
  octave: number;
  isListening: boolean;
}

function midiToY(midi: number, h: number, midiMin: number, midiMax: number): number {
  const clamped = Math.max(midiMin, Math.min(midiMax, midi));
  return ((midiMax - clamped) / (midiMax - midiMin)) * h;
}

/**
 * Draw a smooth Catmull-Rom spline through a set of points.
 * Produces natural meend / glide curves instead of straight segments.
 */
function drawSpline(ctx: CanvasRenderingContext2D, pts: Array<{x: number; y: number}>) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    // Catmull-Rom → cubic bezier conversion (tension = 0.5)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

export function PitchGraph({
  frequency,
  smoothedFrequency,
  targetDegree,
  rootNote,
  octave,
  isListening,
}: PitchGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<PitchPoint[]>([]);
  const rafRef = useRef<number | null>(null);

  // Floating center midi ref for smooth vertical scrolling
  const centerMidiRef = useRef<number | null>(null);

  // Stable props reference for rAF loop
  const propsRef = useRef({ frequency, smoothedFrequency, targetDegree, rootNote, octave, isListening });
  useEffect(() => {
    propsRef.current = { frequency, smoothedFrequency, targetDegree, rootNote, octave, isListening };
  });

  // Push smoothed frequency into history buffer
  useEffect(() => {
    if (!isListening) return;
    if (smoothedFrequency === null || frequency === null) return;
    const smoothedMidi = freqToMidi(smoothedFrequency);
    const rawMidi = freqToMidi(frequency);
    historyRef.current.push({ time: Date.now(), midi: smoothedMidi, rawMidi });
  }, [smoothedFrequency, frequency, isListening]);

  // Clear history when mic stops
  useEffect(() => {
    if (!isListening) {
      historyRef.current = [];
      centerMidiRef.current = null;
    }
  }, [isListening]);

  // Handle canvas DPR-aware resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setSize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(width  * dpr);
      canvas.height = Math.round(height * dpr);
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Single rAF loop — reads live data through propsRef
  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const now = Date.now();
      const windowStart = now - GRAPH_HISTORY_MS * 0.5;
      const { targetDegree: td, rootNote: rn, octave: oct, isListening: listening } = propsRef.current;

      const visible = historyRef.current.filter((p) => p.time >= windowStart);

      // ── Determine Target Center MIDI ────────────────────────────────
      // If user is singing: center Y-axis on the current sung pitch point.
      // If silent: center on target swar if selected, otherwise octave center.
      let targetCenter = sargamDegreeToMidi(0, rn, oct) + 6;
      if (visible.length > 0) {
        targetCenter = visible[visible.length - 1].midi;
      } else if (td !== null) {
        targetCenter = sargamDegreeToMidi(td, rn, oct);
      }

      if (centerMidiRef.current === null) {
        centerMidiRef.current = targetCenter;
      } else {
        // Smooth vertical scroll tracking (lerp)
        centerMidiRef.current += (targetCenter - centerMidiRef.current) * 0.08;
      }

      const midiMin = centerMidiRef.current - 12;
      const midiMax = centerMidiRef.current + 12;
      const centerOct = Math.round(centerMidiRef.current / 12) - 1;

      // Prune very old points
      historyRef.current = historyRef.current.filter((p) => p.time >= windowStart - 1000);

      const drawW = W - LABEL_W; // plot area width

      // ── Background gradient ────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      const bgGrad = ctx.createLinearGradient(LABEL_W, 0, LABEL_W, H);
      bgGrad.addColorStop(0, C.bg);
      bgGrad.addColorStop(1, C.bgFade);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(LABEL_W, 0, drawW, H);

      // Label gutter
      ctx.fillStyle = "#181410";
      ctx.fillRect(0, 0, LABEL_W, H);
      // Separator
      ctx.fillStyle = "rgba(255,240,200,0.07)";
      ctx.fillRect(LABEL_W, 0, 1, H);

      // ── Swara grid lines ─────────────────────────────────────────
      ALL_SEMITONES.forEach(({ label, degree, isNatural }) => {
        // Draw grid lines dynamically relative to the floating center octave
        for (const o of [centerOct - 1, centerOct, centerOct + 1]) {
          const midi = sargamDegreeToMidi(degree, rn, o);
          if (midi < midiMin - 1 || midi > midiMax + 1) continue;
          const y = midiToY(midi, H, midiMin, midiMax);
          const isSa = degree === 0;

          ctx.beginPath();
          ctx.moveTo(LABEL_W, y);
          ctx.lineTo(W, y);

          if (isSa) {
            ctx.strokeStyle = C.gridSa;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([]);
          } else if (isNatural) {
            ctx.strokeStyle = C.grid;
            ctx.lineWidth = 0.7;
            ctx.setLineDash([4, 6]);
          } else {
            // Accidental note — very light micro-dots but visible
            ctx.strokeStyle = "rgba(255, 240, 200, 0.035)";
            ctx.lineWidth = 0.6;
            ctx.setLineDash([1, 6]);
          }

          ctx.stroke();
          ctx.setLineDash([]);

          // Label — show for Sa and natural swaras (clamped to prevent edge clipping)
          if (isNatural) {
            ctx.font = `500 8.5px ui-sans-serif, sans-serif`;
            ctx.fillStyle = isSa ? C.labelSa : C.labelSwara;
            ctx.textAlign = "right";
            const textY = Math.max(8, Math.min(H - 8, y + 3));
            ctx.fillText(`${label} s${o}`, LABEL_W - 5, textY);
          }
        }
      });

      // ── Target swar zone ─────────────────────────────────────────
      const targetMidi = td !== null ? sargamDegreeToMidi(td, rn, oct) : null;
      if (targetMidi !== null) {
        const ty = midiToY(targetMidi, H, midiMin, midiMax);
        const swara = NATURAL_SWARAS.find((s) => s.degree === td);
        const targetLabel = swara?.label ?? "";

        // Tolerance band ±30 cents
        const bandTop    = midiToY(targetMidi + 0.30, H, midiMin, midiMax);
        const bandBottom = midiToY(targetMidi - 0.30, H, midiMin, midiMax);
        const bandH = Math.max(2, bandBottom - bandTop);

        // Glowing band
        const bandGrad = ctx.createLinearGradient(LABEL_W, bandTop, LABEL_W, bandTop + bandH);
        bandGrad.addColorStop(0, "rgba(178,123,53,0.00)");
        bandGrad.addColorStop(0.5, "rgba(178,123,53,0.10)");
        bandGrad.addColorStop(1, "rgba(178,123,53,0.00)");
        ctx.fillStyle = bandGrad;
        ctx.fillRect(LABEL_W, bandTop, drawW, bandH);

        // Target line — amber dashes
        ctx.beginPath();
        ctx.moveTo(LABEL_W, ty);
        ctx.lineTo(W, ty);
        ctx.strokeStyle = C.target;
        ctx.lineWidth = 1;
        ctx.setLineDash([12, 7]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target label pill (right edge)
        if (targetLabel) {
          const pillW = 30;
          const pillH = 16;
          const pillX = W - pillW - 6;
          const pillY = ty - pillH / 2;
          ctx.fillStyle = "rgba(178,123,53,0.90)";
          ctx.beginPath();
          (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void })
            .roundRect(pillX, pillY, pillW, pillH, 4);
          ctx.fill();
          ctx.font = `600 9px ui-sans-serif, sans-serif`;
          ctx.fillStyle = "#fffdf0";
          ctx.textAlign = "center";
          ctx.fillText(targetLabel, pillX + pillW / 2, pillY + pillH / 2 + 3.5);
        }
      }

      // ── Pitch curve ───────────────────────────────────────────────
      if (visible.length > 1) {
        const latestMidi = visible[visible.length - 1].midi;
        const isOnTarget = targetMidi !== null && Math.abs(latestMidi - targetMidi) < 0.30;

        const lineColor = isOnTarget ? C.pitchGreen : C.pitchAmber;
        const glowColor = isOnTarget ? C.pitchGlowOn : C.pitchGlow;

        // Compute screen points — split at silence gaps (>300ms between points)
        const segments: Array<Array<{x: number; y: number}>> = [];
        let current: Array<{x: number; y: number}> = [];

        visible.forEach((p, i) => {
          const x = LABEL_W + ((p.time - windowStart) / GRAPH_HISTORY_MS) * drawW;
          const y = midiToY(p.midi, H, midiMin, midiMax);
          // Gap detection: if more than 350ms between consecutive points → new segment
          if (i > 0 && p.time - visible[i - 1].time > 350) {
            if (current.length > 0) segments.push(current);
            current = [];
          }
          current.push({ x, y });
        });
        if (current.length > 0) segments.push(current);

        // Draw gradient fill under the last segment (most recent)
        const lastSeg = segments[segments.length - 1];
        if (lastSeg && lastSeg.length > 1) {
          const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
          fillGrad.addColorStop(0, isOnTarget ? "rgba(106,171,114,0.18)" : "rgba(200,151,74,0.18)");
          fillGrad.addColorStop(1, "rgba(0,0,0,0)");

          ctx.beginPath();
          drawSpline(ctx, lastSeg);
          // Close fill to bottom
          const lastPt = lastSeg[lastSeg.length - 1];
          const firstPt = lastSeg[0];
          ctx.lineTo(lastPt.x, H);
          ctx.lineTo(firstPt.x, H);
          ctx.closePath();
          ctx.fillStyle = fillGrad;
          ctx.fill();
        }

        // Draw all segments: glow + line passes
        for (const seg of segments) {
          if (seg.length < 2) continue;

          // Glow pass
          ctx.beginPath();
          drawSpline(ctx, seg);
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 9;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.stroke();

          // Main line pass
          ctx.beginPath();
          drawSpline(ctx, seg);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 2;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // Leading dot at head of curve
        const last = visible[visible.length - 1];
        const lx = LABEL_W + ((last.time - windowStart) / GRAPH_HISTORY_MS) * drawW;
        const ly = midiToY(last.midi, H, midiMin, midiMax);

        // Outer ring
        ctx.beginPath();
        ctx.arc(lx, ly, 8, 0, Math.PI * 2);
        ctx.fillStyle = isOnTarget ? "rgba(106,171,114,0.20)" : "rgba(200,151,74,0.15)";
        ctx.fill();
        // Inner dot
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fillStyle = isOnTarget ? C.dotOn : C.dot;
        ctx.fill();

        // Note label near leading dot (top-left of dot)
        const noteLabel = visible[visible.length - 1];
        if (noteLabel) {
          const labelMidi = Math.round(noteLabel.midi);
          const swara = NATURAL_SWARAS.find((s) => {
            const m = sargamDegreeToMidi(s.degree, rn, Math.floor(labelMidi / 12) - 1);
            return Math.abs(labelMidi - m) <= 1;
          });
          if (swara) {
            ctx.font = `600 11px ui-sans-serif, sans-serif`;
            ctx.fillStyle = isOnTarget ? C.dotOn : C.dot;
            ctx.textAlign = lx > W - 60 ? "right" : "left";
            ctx.fillText(swara.label, lx > W - 60 ? lx - 12 : lx + 12, ly - 10);
          }
        }

      } else {
        // Idle / silence state
        ctx.font = `300 12px ui-sans-serif, sans-serif`;
        ctx.fillStyle = listening ? C.silence : C.idle;
        ctx.textAlign = "center";
        ctx.fillText(
          listening ? "Sing to begin…" : "Enable mic to begin tracking",
          LABEL_W + drawW / 2,
          H / 2,
        );
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []); // runs once — all data through refs

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", borderRadius: "inherit" }}
    />
  );
}
