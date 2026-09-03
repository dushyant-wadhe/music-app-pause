"use client";

import { useState, useRef } from "react";
import { useFluteEngine } from "../hooks/useFluteEngine";
import { useFluteStore } from "@/store/useFluteStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { cn } from "@/lib/cn";
import { saveBlobUrlAsRecording } from "@/services/localRecordingStorage";
import { startAudioCapture, stopAudioCapture } from "../engine/audioEngine";
import { RecordingControls, type RecordingController } from "@/features/harmonium/components/RecordingControls";
import type { RootNote } from "@/types";

const SARGAM_MAP: Record<number, string> = {
  0: "Sa",
  1: "Re♭",
  2: "Re",
  3: "Ga♭",
  4: "Ga",
  5: "Ma",
  6: "Ma#",
  7: "Pa",
  8: "Dha♭",
  9: "Dha",
  10: "Ni♭",
  11: "Ni",
};

const SHORTCUTS: Record<number, string> = {
  0: "A",
  1: "W",
  2: "S",
  3: "E",
  4: "D",
  5: "F",
  6: "T",
  7: "G",
  8: "Y",
  9: "H",
  10: "U",
  11: "J",
  12: "K",
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const ROOT_NOTES: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SAPTAKS = [
  { label: "s2", octave: 2 },
  { label: "s3", octave: 3 },
  { label: "s4", octave: 4 },
  { label: "s5", octave: 5 },
  { label: "s6", octave: 6 },
];

function getSargam(note: string, rootNote: RootNote): string {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return note;
  const name = match[1] as RootNote;
  const rootSemi = ROOT_NOTES.indexOf(rootNote);
  const noteSemi = ROOT_NOTES.indexOf(name);
  const relativeSemi = ((noteSemi - rootSemi % 12) + 12) % 12;
  return SARGAM_MAP[relativeSemi] ?? name;
}

function useFluteRecordingController(): RecordingController {
  const { isRecording, startRecording, stopRecording, recordedNotes } = useFluteStore();
  const addRecording = useLibraryStore((s) => s.addRecording);
  const recordings = useLibraryStore((s) => s.recordings);
  const deleteRecording = useLibraryStore((s) => s.deleteRecording);
  const updateStats = useProfileStore((s) => s.updateStats);
  const recordingCount = useLibraryStore((s) => s.recordings.length);

  const [recordingName, setRecordingName] = useState("");
  const [savedBlobUrl, setSavedBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  const sortedRecordings = recordings
    .filter((r) => (r.instrument as string) === "flute" || r.instrument === "other")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  async function handleStart() {
    if (isStarting) return;
    if (savedBlobUrl) URL.revokeObjectURL(savedBlobUrl);
    setError(null);
    setRecordingName("");
    setSavedBlobUrl(null);
    setIsStarting(true);
    try {
      await startAudioCapture((msg) => {
        stopRecording();
        setError(msg);
      });
      startTimeRef.current = Date.now();
      startRecording();
    } catch (captureErr) {
      const msg = captureErr instanceof Error ? captureErr.message : "Recording could not start.";
      setError(msg);
      stopRecording();
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStop() {
    setError(null);
    durationRef.current = Math.round((Date.now() - startTimeRef.current) / 1000);
    stopRecording();
    try {
      const blob = await stopAudioCapture();
      if (!blob || blob.size === 0) {
        setError("No audio was captured. Please try recording again.");
        return;
      }
      setSavedBlobUrl(URL.createObjectURL(blob));
    } catch {
      setError("Recording could not be saved. Please try again.");
    }
  }

  async function handleSave() {
    if (!savedBlobUrl) return;
    const id = crypto.randomUUID();
    let storageUrl: string | null = null;
    try {
      storageUrl = await saveBlobUrlAsRecording(id, savedBlobUrl);
    } catch {
      storageUrl = null;
    }

    const name = recordingName.trim() || `Bansuri Take ${new Date().toLocaleString()}`;
    addRecording({
      id,
      uid: "",
      name,
      durationSeconds: durationRef.current,
      createdAt: new Date(),
      storageUrl,
      isFavorite: false,
      notes: "",
      tags: ["flute", "bansuri"],
      instrument: "flute" as any,
      blobUrl: savedBlobUrl,
    });
    updateStats({ recordingsCount: recordingCount + 1 });
    setSavedBlobUrl(null);
    setRecordingName("");
  }

  function handleDiscard() {
    if (savedBlobUrl) URL.revokeObjectURL(savedBlobUrl);
    setSavedBlobUrl(null);
    setRecordingName("");
  }

  function handleDeleteSavedRecording(id: string, _name: string) {
    deleteRecording(id);
  }

  return {
    isRecording,
    recordedNotesCount: recordedNotes.length,
    recordingsCount: sortedRecordings.length,
    sortedRecordings,
    savedBlobUrl,
    recordingName,
    error,
    isStarting,
    setRecordingName,
    handleStart,
    handleStop,
    handleSave,
    handleDiscard,
    handleDeleteSavedRecording,
  };
}

export function FluteView() {
  const { noteOn, noteOff } = useFluteEngine();
  const {
    volume, setVolume,
    octave, setOctave,
    sustain, setSustain,
    reverbLevel, setReverbLevel,
    transpose, setTranspose,
    rootNote, setRootNote,
    activeNotes,
  } = useFluteStore();

  const recordingController = useFluteRecordingController();
  const [showSettings, setShowSettings] = useState(false);

  // Generate 13 notes for current octave (C to C next octave)
  const notes = Array.from({ length: 13 }, (_, i) => {
    const semitone = i % 12;
    const noteOct = octave + Math.floor(i / 12);
    return `${NOTE_NAMES[semitone]}${noteOct}`;
  });

  const activeNote = Array.from(activeNotes)[0] ?? null;
  const activeSargam = activeNote ? getSargam(activeNote, rootNote) : null;
  const activeOctave = activeNote ? activeNote.slice(-1) : octave;

  // Calculate hole coverage (0 to 7 holes)
  const activeIndex = activeNote
    ? notes.findIndex((n) => n === activeNote)
    : -1;
  const fingeringCount = activeIndex >= 0 ? Math.min(7, Math.floor((activeIndex / 12) * 7) + 1) : 0;

  function pointerHandlers(note: string) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        noteOn(note, 1, `pointer:${e.pointerId}`);
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault();
        noteOff(note, `pointer:${e.pointerId}`);
      },
      onPointerCancel: (e: React.PointerEvent) => {
        e.preventDefault();
        noteOff(note, `pointer:${e.pointerId}`);
      },
      onLostPointerCapture: (e: React.PointerEvent) => {
        noteOff(note, `pointer:${e.pointerId}`);
      },
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onTouchStart: (e: React.TouchEvent) => e.preventDefault(),
      onTouchMove: (e: React.TouchEvent) => e.preventDefault(),
    };
  }

  return (
    <div className="flute-workspace mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-3 md:py-5 relative">
      
      {/* ── Outer Header Controls Bar (Matching Harmonium Reference) ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">
            Riyaaz instrument
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">
            Bansuri Flute
          </h1>
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
            disabled={recordingController.isStarting || Boolean(recordingController.savedBlobUrl)}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            {recordingController.isStarting ? "Starting…" : "Record"}
          </Button>
        )}
      </div>

      {/* ── Main Performance Cabinet Enclosure ── */}
      <Card glow={Boolean(activeNote)} className="flute-performance overflow-hidden border border-[#d7b58d] rounded-xl shadow-lg p-0">
        
        {/* Top Cabinet Control Bar (Root Sa, Saptak, Gear icon) */}
        <div className="flex items-center justify-between gap-2 border-b border-[#2a1405] bg-gradient-to-r from-[#854d27] to-[#693c1d] px-3.5 py-2 text-[#fdf6e2] shadow-md">
          
          {/* Left: Root Sa & Saptak Quick Jumps */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#3d200d] px-2 py-0.5 rounded border border-[#2a1405]">
              <span className="text-[9px] font-bold text-[#fcd34d] uppercase tracking-wider">Root Sa</span>
              <select
                value={rootNote}
                onChange={(e) => setRootNote(e.target.value as RootNote)}
                className="h-6 rounded border-0 bg-transparent px-0.5 text-[11px] font-bold text-[#fdf6e2] focus:outline-none cursor-pointer"
                aria-label="Choose Root Sa note"
              >
                {ROOT_NOTES.map((note) => (
                  <option key={note} value={note} className="bg-[#5c3a21] text-[#fdf6e2]">
                    {note}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-0.5 bg-[#3d200d] p-0.5 rounded border border-[#2a1405] h-7">
              {SAPTAKS.map((item) => (
                <button
                  key={item.octave}
                  onClick={() => setOctave(item.octave)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5 flex items-center justify-center",
                    octave === item.octave
                      ? "bg-[#d97706] text-[#fdf6e2] border-[#b45309] font-extrabold shadow-sm"
                      : "bg-transparent text-[#fcd34d]/80 border-transparent hover:bg-[#5c3a21]"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Gear Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="text-lg text-[#fcd34d] hover:text-[#faf6f0] transition-colors cursor-pointer select-none leading-none px-1"
            aria-label="Open advanced flute settings"
          >
            ⚙
          </button>
        </div>

        {/* Performance Body */}
        <div className="p-3 flex flex-col items-center justify-center gap-2 text-center">

          {/* Floating Live Readout Badge */}
          <div className="flex items-center justify-center gap-2 px-1 flex-wrap">
            <span className="font-serif text-lg font-bold text-[#2f2119]">
              Bansuri
            </span>
            <span className="text-[10px] font-bold text-[#8a5a2b] bg-[#f4e5cf] px-2.5 py-0.5 rounded-full border border-[#cfa675] shadow-xs">
              {activeNote ? `${activeSargam} (${activeNote}) · S${activeOctave}` : `Saptak s${octave} · Root ${rootNote}`}
            </span>
          </div>

          {/* Bansuri Visual Stage */}
          <section className="bansuri-stage !min-h-[170px] md:!min-h-[200px] w-full my-0.5" aria-label="Bansuri performance area">
            <div
              className={cn("bansuri transition-transform duration-200 scale-95 sm:scale-100", activeNote && "is-playing")}
              aria-hidden="true"
            >
              <span className="bansuri-cork" />
              <span className="bansuri-embouchure" />
              <span className="bansuri-grain" />
              <div className="bansuri-holes">
                {Array.from({ length: 7 }, (_, index) => (
                  <span key={index} className={cn(index < fingeringCount && "is-covered")} />
                ))}
              </div>
              <span className="bansuri-end" />
            </div>

            <p className="bansuri-caption text-[9px] mt-1">
              {activeNote ? `Fingering engaged · ${activeSargam}` : "Press keys A–K or touch note tabs below"}
            </p>
          </section>

          {/* Interactive Note Ribbon (Centered inside Cabinet) */}
          <div className="w-full pt-1.5 border-t border-[#dbcdb8]/40">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#7b512b]">
              Fingering Notes ({rootNote} Scale)
            </p>
            <div className="flute-note-ribbon flex flex-wrap justify-center gap-1.5">
              {notes.map((note, index) => {
                const isActive = activeNotes.has(note);
                const sargam = getSargam(note, rootNote);
                const shortcut = SHORTCUTS[index];
                const isBlack = note.includes("#");

                return (
                  <button
                    key={note}
                    type="button"
                    {...pointerHandlers(note)}
                    className={cn(
                      "flute-note-tab relative flex flex-col items-center justify-center min-w-[40px] sm:min-w-[44px] h-11 rounded-lg border transition-all select-none touch-none",
                      isBlack ? "bg-[#3d200d] text-[#fcd34d] border-[#2a1405]" : "bg-[#fffaf2] text-[#6d4324] border-[#d5b98f]",
                      isActive && "is-active scale-95 shadow-inner"
                    )}
                    aria-label={`Play ${sargam} (${note})`}
                  >
                    {shortcut && (
                      <span className="absolute top-0.5 text-[8px] font-bold opacity-60 uppercase tracking-tighter">
                        {shortcut}
                      </span>
                    )}
                    <span className="text-xs font-bold leading-none mt-1">
                      {sargam}
                    </span>
                    <span className="text-[7px] opacity-70 mt-0.5">
                      {note}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </Card>

      {/* ── Saved Recordings Section ── */}
      <RecordingControls controller={recordingController} />

      {/* ── Slide-over Settings Drawer ── */}
      <div
        className={cn(
          "fixed inset-0 z-45 bg-black/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-none opacity-0",
          showSettings && "pointer-events-auto opacity-100"
        )}
        onClick={() => setShowSettings(false)}
      />

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 bg-[#faf6f0] border-l border-[#ead9c1] shadow-2xl p-5 flex flex-col gap-4 overflow-y-auto transition-transform duration-300 ease-in-out translate-x-full",
          showSettings && "translate-x-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-[#ead9c1] pb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7b512b]">
            ⚙ Advanced Flute Settings
          </p>
          <button
            onClick={() => setShowSettings(false)}
            className="text-[10px] font-bold uppercase tracking-wider text-[#8c6239] hover:text-[#5c3a21] cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Slider
            label="Master Volume"
            value={Math.round(volume * 100)}
            min={0}
            max={100}
            onChange={(v) => setVolume(v / 100)}
            formatValue={(v) => `${v}%`}
          />

          <Slider
            label="Room Reverb"
            value={Math.round(reverbLevel * 100)}
            min={0}
            max={100}
            onChange={(v) => setReverbLevel(v / 100)}
            formatValue={(v) => `${v}%`}
          />

          <Slider
            label="Sustain"
            value={Math.round(sustain * 100)}
            min={0}
            max={100}
            onChange={(v) => setSustain(v / 100)}
            formatValue={(v) => `${v}%`}
          />

          <Slider
            label="Transpose"
            value={transpose}
            min={-6}
            max={6}
            onChange={setTranspose}
            formatValue={(v) => (v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`)}
          />
        </div>
      </div>

    </div>
  );
}
