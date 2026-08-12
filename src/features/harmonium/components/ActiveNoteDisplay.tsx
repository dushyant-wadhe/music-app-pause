"use client";

import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { sargamForNote } from "../utils/sargam";

export function ActiveNoteDisplay() {
  const { activeNotes, rootNote } = useHarmoniumStore();

  const notes = Array.from(activeNotes);

  return (
    <div className="flex items-center gap-2 min-h-8 flex-wrap">
      {notes.length === 0 ? (
        <span className="text-xs italic text-[#5f6877]">Play a key...</span>
      ) : (
        notes.map((note) => {
          const noteName = sargamForNote(note, rootNote);
          return (
            <span
              key={note}
              className="rounded border border-[#c7ab83] bg-[#f6ead4] px-3 py-1 text-sm font-semibold text-[#724622]"
            >
              {noteName}
            </span>
          );
        })
      )}
    </div>
  );
}
