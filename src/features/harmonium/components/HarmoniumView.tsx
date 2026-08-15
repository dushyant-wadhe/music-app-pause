"use client";

import { useHarmoniumEngine } from "../hooks/useHarmoniumEngine";
import { HarmoniumKeyboard } from "./HarmoniumKeyboard";
import { HarmoniumControls } from "./HarmoniumControls";
import { Button } from "@/components/ui/Button";
import { RecordingControls, useRecordingController } from "./RecordingControls";
import { ActiveNoteDisplay } from "./ActiveNoteDisplay";
import { useHarmoniumStore } from "@/store/useHarmoniumStore";

export function HarmoniumView() {
  const { handleNoteOn, handleNoteOff } = useHarmoniumEngine();
  const recordingController = useRecordingController();
  const isPlaying = useHarmoniumStore((state) => state.activeNotes.size > 0);

  return (
    <div className="harmonium-workspace flex w-full flex-col gap-5 px-2 py-3 md:py-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">Riyaaz instrument</p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">Harmonium</h1>
          <p className="mt-1 text-xs text-[#75685b]">A S D F G H J · W E T Y U</p>
        </div>
        {recordingController.isRecording ? (
          <Button variant="danger" size="sm" onClick={recordingController.handleStop}>
            <span className="h-2 w-2 rounded-full bg-[#fecaca] animate-pulse" />
            Stop recording
          </Button>
        ) : (
          <Button
            variant="surface"
            size="sm"
            onClick={recordingController.handleStart}
            disabled={recordingController.isStarting}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            {recordingController.isStarting ? "Starting…" : "Record"}
          </Button>
        )}
      </div>

      <section className="harmonium-cabinet" aria-label="Harmonium performance area">
        <div className="harmonium-cabinet-rail" aria-hidden="true" />
        <div className="harmonium-keywell">
          <div className="flex items-center justify-between border-b border-[#d4b184]/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#74451f]">Manual</p>
            <ActiveNoteDisplay />
          </div>
          <div className="p-3 pb-2 md:p-4">
            <HarmoniumKeyboard onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
          </div>
        </div>
        <div className={`harmonium-bellows ${isPlaying ? "is-playing" : ""}`} aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
      </section>

      <HarmoniumControls />

      <RecordingControls controller={recordingController} />
    </div>
  );
}
