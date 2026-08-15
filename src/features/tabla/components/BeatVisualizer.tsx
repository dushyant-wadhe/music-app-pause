"use client";

import { useTablaStore } from "@/store/useTablaStore";
import { resolveTablaVariant, TAALS } from "../data/taals";
import { cn } from "@/lib/cn";

export function BeatVisualizer() {
  const { currentBeat, isPlaying, selectedTaal, patternLayer, stylePackId, variantId } = useTablaStore();
  const taal = TAALS[selectedTaal];
  if (!taal) return null;

  const resolved = resolveTablaVariant(selectedTaal, patternLayer, variantId, stylePackId);
  const activePattern = resolved.variant?.pattern?.length ? resolved.variant.pattern : taal.pattern;

  // Group beats by vibhag and compute Sam / Tali / Khali markers
  const vibhags = taal.vibhags.reduce<{
    groups: { beats: typeof activePattern; isSam: boolean; isKhali: boolean; vi: number; marker: string }[];
    beatOffset: number;
    taliCount: number;
  }>((result, count, vi) => {
    const beats = activePattern.slice(result.beatOffset, result.beatOffset + count);
    const isSam = beats[0]?.isSam ?? false;
    const isKhali = beats[0]?.isKhali ?? false;
    const marker = vi === 0 ? "X" : isKhali ? "0" : String(result.taliCount + 1);

    result.groups.push({ beats, isSam, isKhali, vi, marker });
    return {
      groups: result.groups,
      beatOffset: result.beatOffset + count,
      taliCount: isKhali || vi === 0 ? result.taliCount : result.taliCount + 1,
    };
  }, { groups: [], beatOffset: 0, taliCount: 1 }).groups;

  return (
    <div className="tabla-beat-visualizer flex flex-col gap-3" aria-label={`${selectedTaal} beat pattern`}>
      <div className="flex items-start gap-3 flex-wrap">
        {vibhags.map(({ beats, isSam, isKhali, vi, marker }) => (
          <div key={vi} className="flex flex-col items-start gap-1">
            {/* Vibhag marker: X (Sam) / 0 (Khali) / number (Tali) */}
            <span
              className={cn(
                "text-[11px] font-bold tracking-widest",
                isSam && !isKhali && "text-[#8a5a2b]",
                isKhali && !isSam && "text-[#6b7280]",
                isSam && isKhali && "text-[#8a5a2b]/60",
                !isSam && !isKhali && "text-[#6b7280]"
              )}
            >
              {marker}
            </span>

            {/* Beat cells */}
            <div className="flex gap-1.5">
              {beats.map((beat) => {
                const isActive = isPlaying && currentBeat === beat.index;
                return (
                  <div
                    key={beat.index}
                    className={cn(
                      "flex flex-col items-center gap-0.5",
                      isActive && "beat-active"
                    )}
                  >
                    <div
                      className={cn(
                        "tabla-beat-cell w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold",
                        "border transition-all duration-75 select-none",
                        isActive &&
                          "bg-[#6f3e21] text-[#fff8ed] border-[#51301d] scale-105",
                        !isActive && beat.isSam && !beat.isKhali &&
                          "bg-[#f4e5cf] text-[#75451f] border-[#cfa675]",
                        !isActive && beat.isSam && beat.isKhali &&
                          "bg-[#f7eddf] text-[#8a5a2b]/60 border-[#e3ccb0]",
                        !isActive && !beat.isSam && beat.isKhali &&
                          "bg-[#f9f4eb] text-[#817263] border-[#dfd1bd]",
                        !isActive && !beat.isSam && !beat.isKhali &&
                          "bg-[#fffaf3] text-[#55473d] border-[#dfd1bd]"
                      )}
                    >
                      {beat.syllable}
                    </div>
                    <span className="text-[9px] font-mono text-[#6b7280]">
                      {beat.index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap pt-1">
        <span className="flex items-center gap-1 text-[9px] text-[#6b7280]">
          <span className="font-bold text-[#8a5a2b]">X</span> Sam (first beat)
        </span>
        <span className="flex items-center gap-1 text-[9px] text-[#6b7280]">
          <span className="font-bold text-[#6b7280]">2,3...</span> Tali (strong beat)
        </span>
        <span className="flex items-center gap-1 text-[9px] text-[#6b7280]">
          <span className="font-bold">0</span> Khali (empty beat)
        </span>
      </div>
    </div>
  );
}
