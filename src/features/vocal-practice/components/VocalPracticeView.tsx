"use client";

import { useState, useRef, useEffect } from "react";
import { usePitchDetector } from "../hooks/usePitchDetector";
import { PitchGraph } from "./PitchGraph";
import { TargetNote } from "./TargetNote";
import { Button } from "@/components/ui/Button";
import { freqToMidi, sargamDegreeToMidi } from "../utils/sargamPitch";
import { useTanpuraStore, type TanpuraDroneMode } from "@/store/useTanpuraStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { RecordingControls, type RecordingController } from "@/features/harmonium/components/RecordingControls";
import { saveBlobUrlAsRecording } from "@/services/localRecordingStorage";
import { getUserMicStream } from "../engine/pitchDetector";
import { cn } from "@/lib/cn";
import type { RootNote } from "@/types";

const ROOT_NOTES: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SAPTAKS = [
  { label: "s2", octave: 2 },
  { label: "s3", octave: 3 },
  { label: "s4", octave: 4 },
  { label: "s5", octave: 5 },
  { label: "s6", octave: 6 },
];

function useVocalRecordingController(): RecordingController {
  const recordings = useLibraryStore((s) => s.recordings);
  const addRecording = useLibraryStore((s) => s.addRecording);
  const deleteRecording = useLibraryStore((s) => s.deleteRecording);
  const updateStats = useProfileStore((s) => s.updateStats);
  const recordingCount = recordings.length;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState("");
  const [savedBlobUrl, setSavedBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  const sortedRecordings = recordings
    .filter((r) => (r.instrument as string) === "voice" || r.instrument === "other")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  async function handleStart() {
    if (isStarting || isRecording) return;
    if (savedBlobUrl) URL.revokeObjectURL(savedBlobUrl);
    setError(null);
    setRecordingName("");
    setSavedBlobUrl(null);
    setIsStarting(true);
    try {
      const stream = await getUserMicStream();
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (captureErr) {
      const msg = captureErr instanceof Error ? captureErr.message : "Microphone recording could not start.";
      setError(msg);
      setIsRecording(false);
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStop() {
    setError(null);
    durationRef.current = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size === 0) {
      setError("No audio captured. Please try recording again.");
      return;
    }
    setSavedBlobUrl(URL.createObjectURL(blob));
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

    const name = recordingName.trim() || `Vocal Take ${new Date().toLocaleString()}`;
    addRecording({
      id,
      uid: "",
      name,
      durationSeconds: durationRef.current,
      createdAt: new Date(),
      storageUrl,
      isFavorite: false,
      notes: "",
      tags: ["voice", "alap"],
      instrument: "other",
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
    recordedNotesCount: 0,
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

export function VocalPracticeView() {
  const [rootNote, setRootNote] = useState<RootNote>("C");
  const [octave, setOctave] = useState(4);
  const [targetDegree, setTargetDegree] = useState<number | null>(null);

  const { pitch, permission, startListening, stopListening } = usePitchDetector(rootNote);
  const recordingController = useVocalRecordingController();

  const { mode: tanpuraMode, setMode: setTanpuraMode, setRootNote: setTanpuraRoot, setOctave: setTanpuraOctave } = useTanpuraStore();

  const isListening = pitch.isListening;

  const liveLabel = pitch.noteInfo
    ? { sargam: pitch.noteInfo.sargam, cents: pitch.cents, accuracy: pitch.accuracy }
    : null;

  const targetMidi = targetDegree !== null ? sargamDegreeToMidi(targetDegree, rootNote, octave) : null;
  const isMatching = targetMidi !== null && pitch.smoothedFrequency !== null &&
    Math.abs(freqToMidi(pitch.smoothedFrequency) - targetMidi) < 0.30;

  const isInTune = pitch.accuracy === "on";

  // Keep Tanpura Drone synced to the exact Root Sa and Octave selected in Voice Practice
  useEffect(() => {
    setTanpuraRoot(rootNote);
    setTanpuraOctave(Math.max(2, Math.min(5, octave)));
  }, [rootNote, octave, setTanpuraOctave, setTanpuraRoot]);

  function handleRootNoteChange(n: RootNote) {
    setRootNote(n);
    setTanpuraRoot(n);
  }

  function handleOctaveChange(oct: number) {
    setOctave(oct);
    setTanpuraOctave(Math.max(2, Math.min(5, oct)));
  }

  function toggleDrone() {
    if (tanpuraMode === "off") {
      setTanpuraRoot(rootNote);
      setTanpuraOctave(Math.max(2, Math.min(5, octave)));
      setTanpuraMode("sa");
    } else {
      setTanpuraMode("off");
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">

      {/* ── Outer Header Bar (Matching Harmonium Reference) ───────────────── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">
            Riyaaz instrument
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">
            Voice Practice <span className="text-xs font-sans font-semibold text-[#8a735b]">(Swar Alap)</span>
          </h1>
        </div>

        {/* Right Action Controls: Record Button + Mic Toggle */}
        <div className="flex items-center gap-2">
          {recordingController.isRecording ? (
            <Button variant="danger" size="sm" onClick={recordingController.handleStop} className="h-8 text-xs gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#fecaca] animate-pulse" />
              Stop
            </Button>
          ) : (
            <Button
              variant="surface"
              size="sm"
              onClick={recordingController.handleStart}
              disabled={recordingController.isStarting || Boolean(recordingController.savedBlobUrl)}
              className="h-8 text-xs gap-1.5"
            >
              <span className="h-2 w-2 rounded-full bg-[#dc2626]" />
              {recordingController.isStarting ? "Starting…" : "Record"}
            </Button>
          )}

          <button
            onClick={isListening ? stopListening : startListening}
            disabled={permission === "requesting" || permission === "unsupported"}
            className="flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer h-8 border shadow-xs"
            style={{
              background: isListening
                ? "var(--app-fg)"
                : "var(--surface-soft)",
              color: isListening ? "#fffdf9" : "var(--ink-soft)",
              borderColor: isListening ? "var(--app-fg)" : "var(--card-border)",
            }}
          >
            {isListening ? (
              <>
                <span
                  className="h-2 w-2 rounded-full inline-block bg-[#5aa064] animate-pulse"
                  style={{ boxShadow: "0 0 0 2.5px rgba(90,160,100,0.30)" }}
                />
                Mic ON
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full inline-block bg-gray-400" />
                Mic OFF
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Wood-Grain Control Console Bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#2a1405] bg-gradient-to-r from-[#854d27] to-[#693c1d] px-3.5 py-2 text-[#fdf6e2] shadow-md">
        
        {/* Left: Root Sa & Saptak Quick Jumps + Tanpura Drone Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#3d200d] px-2 py-0.5 rounded border border-[#2a1405]">
            <span className="text-[9px] font-bold text-[#fcd34d] uppercase tracking-wider">Root Sa</span>
            <select
              value={rootNote}
              onChange={(e) => handleRootNoteChange(e.target.value as RootNote)}
              className="h-6 rounded border-0 bg-transparent px-0.5 text-[11px] font-bold text-[#fdf6e2] focus:outline-none cursor-pointer"
              aria-label="Choose Root Sa note"
            >
              {ROOT_NOTES.map((n) => (
                <option key={n} value={n} className="bg-[#5c3a21] text-[#fdf6e2]">
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-0.5 bg-[#3d200d] p-0.5 rounded border border-[#2a1405] h-7">
            {SAPTAKS.map((item) => (
              <button
                key={item.octave}
                onClick={() => handleOctaveChange(item.octave)}
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

          {/* Quick Tanpura Drone Pill Toggle */}
          <button
            onClick={toggleDrone}
            className={cn(
              "px-2.5 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-7 flex items-center gap-1.5 select-none",
              tanpuraMode !== "off"
                ? "bg-[#d97706] text-[#fdf6e2] border-[#b45309] font-extrabold shadow-sm"
                : "bg-[#3d200d] text-[#fcd34d]/90 border-[#2a1405] hover:bg-[#5c3a21]"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", tanpuraMode !== "off" ? "bg-[#fef08a] animate-pulse" : "bg-gray-400")} />
            Drone: {tanpuraMode !== "off" ? tanpuraMode.toUpperCase() : "OFF"}
          </button>
        </div>

        {/* Right section: Target Note Selector */}
        <div className="flex items-center gap-2">
          <TargetNote
            rootNote={rootNote}
            octave={octave}
            selectedDegree={targetDegree}
            onSelectDegree={setTargetDegree}
          />
        </div>
      </div>

      {/* ── Main Workspace Cards ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {/* Live Readout & Status Strip */}
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{
            background: isMatching ? "rgba(58,122,68,0.08)" : permission === "denied" ? "rgba(185,56,47,0.05)" : "var(--card-bg)",
            border: `1.5px solid ${isMatching ? "rgba(58,122,68,0.28)" : permission === "denied" ? "rgba(185,56,47,0.28)" : "var(--card-border)"}`,
            transition: "background 0.4s, border-color 0.4s",
            minHeight: "52px",
          }}
        >
          {permission === "denied" ? (
            <span className="text-xs font-semibold text-[#a73028]">
              ⚠️ Microphone access is blocked. Please allow mic in browser settings and reload.
            </span>
          ) : permission === "unsupported" ? (
            <span className="text-xs font-semibold text-[#a73028]">
              ⚠️ Live pitch detection is not supported in this browser. Please use Chrome or Safari.
            </span>
          ) : !isListening ? (
            <span className="text-xs font-semibold text-[var(--ink-soft)]">
              🎙 Click <strong>&quot;Mic OFF&quot;</strong> above to start live pitch tracking.
            </span>
          ) : liveLabel ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-baseline gap-3">
                <span
                  className="font-serif font-bold text-2xl tracking-tight"
                  style={{ color: "var(--accent-700)" }}
                >
                  {liveLabel.sargam}
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--app-fg)" }}>
                  {pitch.noteInfo?.noteName}
                </span>
                <span className="text-[11px] font-mono text-[var(--ink-soft)]">
                  {pitch.frequency ? `${pitch.frequency.toFixed(1)} Hz` : ""}
                </span>
              </div>

              {/* Accuracy Badge */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border"
                  style={{
                    background: isInTune
                      ? "rgba(58,122,68,0.12)"
                      : pitch.accuracy === "sharp"
                      ? "rgba(217,119,6,0.12)"
                      : "rgba(37,99,235,0.12)",
                    color: isInTune
                      ? "#2e6a39"
                      : pitch.accuracy === "sharp"
                      ? "#b45309"
                      : "#1d4ed8",
                    borderColor: isInTune
                      ? "rgba(58,122,68,0.30)"
                      : pitch.accuracy === "sharp"
                      ? "rgba(217,119,6,0.30)"
                      : "rgba(37,99,235,0.30)",
                  }}
                >
                  {isInTune
                    ? "In Tune ✓"
                    : pitch.accuracy === "sharp"
                    ? `Sharp +${liveLabel.cents}¢`
                    : `Flat ${liveLabel.cents}¢`}
                </span>

                {isMatching && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-[#3a7a44] text-white animate-bounce">
                    Matched! 🎯
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs font-semibold text-[var(--ink-soft)] animate-pulse">
              Listening… Sing or hum a note into your mic.
            </span>
          )}
        </div>

        {/* Realtime Pitch Visualizer Graph */}
        <div
          className="w-full overflow-hidden rounded-2xl shadow-lg border border-[#3d2f21]"
          style={{
            height: "calc(100vh - 320px)",
            minHeight: "380px",
            maxHeight: "520px",
          }}
        >
          <PitchGraph
            frequency={pitch.frequency}
            smoothedFrequency={pitch.smoothedFrequency}
            targetDegree={targetDegree}
            rootNote={rootNote}
            octave={octave}
            isListening={isListening}
          />
        </div>
      </div>

      {/* ── Saved Recordings Section ── */}
      <RecordingControls controller={recordingController} />

    </div>
  );
}
