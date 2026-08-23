"use client";

import { useHarmoniumEngine } from "../hooks/useHarmoniumEngine";
import { HarmoniumKeyboard } from "./HarmoniumKeyboard";
import { Button } from "@/components/ui/Button";
import { RecordingControls, useRecordingController } from "./RecordingControls";

export function HarmoniumView() {
  const { handleNoteOn, handleNoteOff } = useHarmoniumEngine();
  const recordingController = useRecordingController();

  return (
    <div className="harmonium-workspace flex w-full flex-col gap-5 px-2 py-3 md:py-5 relative">
      {/* Header controls bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">Riyaaz instrument</p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">Harmonium</h1>
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

      {/* Main Cabinet */}
      <section className="harmonium-cabinet relative overflow-hidden" aria-label="Harmonium performance area">
        {/* Brass Corner Braces */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#d97706] rounded-tl-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#d97706] rounded-tr-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#d97706] rounded-bl-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#d97706] rounded-br-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />

        <div className="harmonium-cabinet-rail" aria-hidden="true" />
        <div className="harmonium-keywell overflow-hidden">
          {/* Geometric Jali at the very top of the cabinet */}
          <div className="bg-gradient-to-b from-[#854d27] to-[#693c1d] p-3 border-b border-[#2a1405] relative shadow-inner">
            {/* Jali gold accents */}
            <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#fcd34d]/30 rounded-tl-sm pointer-events-none" />
            <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[#fcd34d]/30 rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#fcd34d]/30 rounded-bl-sm pointer-events-none" />
            <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#fcd34d]/30 rounded-br-sm pointer-events-none" />
            
            <svg className="w-full h-8 opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <pattern id="jali-pattern-geometric" width="48" height="32" patternUnits="userSpaceOnUse">
                {/* Diagonal connecting lines */}
                <line x1="8" y1="16" x2="24" y2="4" stroke="#251205" strokeWidth="2" />
                <line x1="24" y1="4" x2="40" y2="16" stroke="#251205" strokeWidth="2" />
                <line x1="8" y1="16" x2="24" y2="28" stroke="#251205" strokeWidth="2" />
                <line x1="24" y1="28" x2="40" y2="16" stroke="#251205" strokeWidth="2" />
                <line x1="24" y1="4" x2="24" y2="28" stroke="#251205" strokeWidth="1" strokeDasharray="2 2" />
                
                {/* Circular cutouts */}
                <circle cx="8" cy="16" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
                <circle cx="24" cy="4" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
                <circle cx="24" cy="16" r="3.5" fill="#140802" stroke="#48250e" strokeWidth="1" />
                <circle cx="24" cy="28" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
                <circle cx="40" cy="16" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="32" fill="url(#jali-pattern-geometric)" />
            </svg>
          </div>

          {/* Keyboard Enclosure - warm mahogany wood color */}
          <div className="bg-[#854d27]">
            <HarmoniumKeyboard onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
          </div>
        </div>
      </section>

      {/* Recording Controls */}
      <RecordingControls controller={recordingController} />
    </div>
  );
}
