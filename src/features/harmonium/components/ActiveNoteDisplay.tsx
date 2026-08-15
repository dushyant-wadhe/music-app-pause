"use client";

import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { sargamForNote } from "../utils/sargam";

export function ActiveNoteDisplay() {
  const { activeNotes, rootNote } = useHarmoniumStore();

  const notes = Array.from(activeNotes);

  return (
    <div className="flex min-h-6 items-center gap-1.5 flex-wrap">
      {notes.length === 0 ? (
        <span className="text-[11px] italic text-[#8d7c69]">Ready</span>
      ) : (
        notes.map((note) => {
          const noteName = sargamForNote(note, rootNote);
          return (
            <span
              key={note}
              className="rounded-sm border border-[#caa06d] bg-[#f7e6cd] px-2 py-0.5 text-xs font-semibold text-[#724622] shadow-[inset_0_1px_0_rgba(255,255,255,.7)]"
            >
              {noteName}
            </span>
          );
        })
      )}
    </div>
  );
}
