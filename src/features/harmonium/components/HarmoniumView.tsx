"use client";

import { useState, useEffect } from "react";
import { useHarmoniumEngine } from "../hooks/useHarmoniumEngine";
import { HarmoniumKeyboard } from "./HarmoniumKeyboard";
import { Button } from "@/components/ui/Button";
import { RecordingControls, useRecordingController } from "./RecordingControls";

export function HarmoniumView() {
  const { handleNoteOn, handleNoteOff } = useHarmoniumEngine();
  const recordingController = useRecordingController();

  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreenLandscape, setIsFullscreenLandscape] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sync fullscreen state changes (e.g. Esc button exits)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenLandscape(false);
        const orientation = screen.orientation as unknown as { lock?: (type: string) => Promise<void>; unlock?: () => void };
        if (orientation && orientation.unlock) {
          try {
            orientation.unlock();
          } catch {
            // ignore orientation errors
          }
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const enterAppMode = async () => {
    setIsFullscreenLandscape(true);
    const docEl = document.documentElement;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      }
      const orientation = screen.orientation as unknown as { lock?: (type: string) => Promise<void>; unlock?: () => void };
      if (orientation && orientation.lock) {
        await orientation.lock("landscape");
      }
    } catch {
      // orientation or fullscreen lock failed/unsupported in Safari/iOS
    }
  };

  const exitAppMode = async () => {
    setIsFullscreenLandscape(false);
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
      const orientation = screen.orientation as unknown as { lock?: (type: string) => Promise<void>; unlock?: () => void };
      if (orientation && orientation.unlock) {
        orientation.unlock();
      }
    } catch {
      // ignore exit errors
    }
  };

  // The main performance component (Cabinet + Keyboard)
  const renderCabinet = () => (
    <section
      className="harmonium-cabinet relative overflow-hidden w-full"
      aria-label="Harmonium performance area"
      style={{
        borderRadius: isFullscreenLandscape ? "0" : "1rem",
        border: isFullscreenLandscape ? "none" : "1.5px solid var(--card-border)",
      }}
    >
      {/* Brass Corner Braces (Hidden in fullscreen mode for clean look) */}
      {!isFullscreenLandscape && (
        <>
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#d97706] rounded-tl-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#d97706] rounded-tr-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#d97706] rounded-bl-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#d97706] rounded-br-md shadow-sm z-30 pointer-events-none bg-[#fcd34d]/10" />
        </>
      )}

      <div className="harmonium-cabinet-rail" aria-hidden="true" />
      <div className="harmonium-keywell overflow-hidden">
        {/* Geometric Jali at the very top of the cabinet */}
        <div className="bg-gradient-to-b from-[#854d27] to-[#693c1d] p-3 border-b border-[#2a1405] relative shadow-inner">
          <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#fcd34d]/30 rounded-tl-sm pointer-events-none" />
          <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[#fcd34d]/30 rounded-tr-sm pointer-events-none" />
          <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#fcd34d]/30 rounded-bl-sm pointer-events-none" />
          <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#fcd34d]/30 rounded-br-sm pointer-events-none" />
          
          <svg className="w-full h-8 opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <pattern id="jali-pattern-geometric" width="48" height="32" patternUnits="userSpaceOnUse">
              <line x1="8" y1="16" x2="24" y2="4" stroke="#251205" strokeWidth="2" />
              <line x1="24" y1="4" x2="40" y2="16" stroke="#251205" strokeWidth="2" />
              <line x1="8" y1="16" x2="24" y2="28" stroke="#251205" strokeWidth="2" />
              <line x1="24" y1="28" x2="40" y2="16" stroke="#251205" strokeWidth="2" />
              <line x1="24" y1="4" x2="24" y2="28" stroke="#251205" strokeWidth="1" strokeDasharray="2 2" />
              
              <circle cx="8" cy="16" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
              <circle cx="24" cy="4" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
              <circle cx="24" cy="16" r="3.5" fill="#140802" stroke="#48250e" strokeWidth="1" />
              <circle cx="24" cy="28" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
              <circle cx="40" cy="16" r="4" fill="#140802" stroke="#48250e" strokeWidth="1" />
            </pattern>
            <rect width="100%" height="32" fill="url(#jali-pattern-geometric)" />
          </svg>
        </div>

        {/* Keyboard Enclosure */}
        <div className="bg-[#854d27]">
          <HarmoniumKeyboard onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
        </div>
      </div>

      {/* Portrait Mobile Overlay */}
      {isMobile && !isFullscreenLandscape && (
        <div
          className="absolute inset-0 z-40 bg-[#1e1a15]/75 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6"
          style={{ border: "1.5px solid var(--card-border)" }}
        >
          <div className="mb-4 text-[#d97706] text-3xl">🎹</div>
          <h2
            className="mb-2 font-serif text-lg font-bold"
            style={{ color: "#fffdf0" }}
          >
            Landscape Mode Recommended
          </h2>
          <p className="text-xs leading-relaxed max-w-[240px] mb-5" style={{ color: "rgba(255,255,255,0.7)" }}>
            For the best playing experience, rotate your phone or enter full-screen app mode.
          </p>
          <button
            onClick={enterAppMode}
            className="rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-all active:scale-95 shadow-md cursor-pointer"
            style={{
              background: "var(--accent-700)",
              boxShadow: "0 4px 15px rgba(217,119,6,0.3)",
            }}
          >
            Play Fullscreen App Mode
          </button>
        </div>
      )}

      {/* Floating Exit Button in Fullscreen App Mode */}
      {isFullscreenLandscape && (
        <button
          onClick={exitAppMode}
          className="fixed top-4 right-4 z-50 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer border border-white/20 transition-all font-sans text-sm font-bold shadow-lg"
          title="Exit Fullscreen Mode"
        >
          ✕
        </button>
      )}
    </section>
  );

  return (
    <div className="harmonium-workspace flex w-full flex-col gap-5 px-2 py-3 md:py-5 relative">
      {/* Normal View Layout */}
      {!isFullscreenLandscape ? (
        <>
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

          {/* Performance Cabinet Enclosure */}
          {renderCabinet()}

          {/* Recording Controls */}
          <RecordingControls controller={recordingController} />
        </>
      ) : (
        /* Fullscreen Landscape Performance Mode */
        <div className="fixed inset-0 z-50 bg-[#140802] flex items-center justify-center p-1 w-screen h-screen">
          <div className="w-full max-h-screen">
            {renderCabinet()}
          </div>
        </div>
      )}
    </div>
  );
}
