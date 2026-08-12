"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoaderState } from "@/components/ui/LoaderState";
import { MiniAudioPlayer } from "@/features/harmonium/components/RecordingControls";
import { HarmoniumView } from "@/features/harmonium/components/HarmoniumView";
import { createHarmoniumCaptureTap } from "@/features/harmonium/engine/audioEngine";
import { TablaView } from "@/features/tabla/components/TablaView";
import { createTablaCaptureTap } from "@/features/tabla/engine/rhythmEngine";
import { TanpuraView } from "@/features/tanpura/components/TanpuraView";
import { saveBlobUrlAsRecording } from "@/services/localRecordingStorage";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { PracticeSessionCard } from "@/types";

interface SessionRunViewProps {
  sessionId: string;
}

export function SessionRunView({ sessionId }: SessionRunViewProps) {
  const router = useRouter();
  const hasHydrated = useLibraryStore((state) => state.hasHydrated);
  const sessions = useLibraryStore((state) => state.sessions);
  const playSession = useLibraryStore((state) => state.playSession);
  const updateSession = useLibraryStore((state) => state.updateSession);
  const addRecording = useLibraryStore((state) => state.addRecording);
  const [activeTool, setActiveTool] = useState<PracticeSessionCard["type"] | "tanpura">("harmonium");
  const [isSessionRecording, setIsSessionRecording] = useState(false);
  const [isSessionRecordingPaused, setIsSessionRecordingPaused] = useState(false);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState("");
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);

  const recordingStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingPausedAtRef = useRef<number | null>(null);
  const recordingPausedMsRef = useRef(0);
  const captureTapsRef = useRef<Array<{ dispose: () => void }>>([]);
  const mixContextRef = useRef<AudioContext | null>(null);
  const mixSourceNodesRef = useRef<MediaStreamAudioSourceNode[]>([]);

  const session = sessions.find((entry) => entry.id === sessionId);

  useEffect(() => {
    if (!session) return;
    if (session.status !== "playing" && session.cards.some((card) => card.enabled)) {
      playSession(session.id);
    }
  }, [session, playSession]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      captureTapsRef.current.forEach((tap) => tap.dispose());
      captureTapsRef.current = [];
      mixSourceNodesRef.current.forEach((node) => {
        try {
          node.disconnect();
        } catch {
          // ignore cleanup errors
        }
      });
      mixSourceNodesRef.current = [];
      void mixContextRef.current?.close();
      mixContextRef.current = null;
    };
  }, []);

  async function startSessionRecording() {
    if (recordingBlobUrl) return;
    setRecordError(null);
    try {
      if (typeof MediaRecorder === "undefined") {
        setRecordError("Recording is not supported in this browser.");
        return;
      }

      const harmoniumTap = createHarmoniumCaptureTap();
      const tablaTap = createTablaCaptureTap();
      const mixContext = new AudioContext({ latencyHint: "interactive" });
      const mixDestination = mixContext.createMediaStreamDestination();
      const harmoniumSource = mixContext.createMediaStreamSource(harmoniumTap.stream);
      const tablaSource = mixContext.createMediaStreamSource(tablaTap.stream);
      harmoniumSource.connect(mixDestination);
      tablaSource.connect(mixDestination);

      const recorder = new MediaRecorder(mixDestination.stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recordingPausedAtRef.current = null;
      recordingPausedMsRef.current = 0;
      recordingStreamRef.current = mixDestination.stream;
      mediaRecorderRef.current = recorder;
      captureTapsRef.current = [harmoniumTap, tablaTap];
      mixContextRef.current = mixContext;
      mixSourceNodesRef.current = [harmoniumSource, tablaSource];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0 && session) {
          const startedAt = recordingStartedAtRef.current ?? Date.now();
          const pausedMs = recordingPausedMsRef.current;
          const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt - pausedMs) / 1000));
          const blobUrl = URL.createObjectURL(blob);
          setRecordingBlobUrl(blobUrl);
          setRecordingDurationSeconds(durationSeconds);
          setRecordingName(`${session.name} · ${new Date().toLocaleDateString()}`);
        }

        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        recordingStartedAtRef.current = null;
        recordingPausedAtRef.current = null;
        recordingPausedMsRef.current = 0;
        captureTapsRef.current.forEach((tap) => tap.dispose());
        captureTapsRef.current = [];
        mixSourceNodesRef.current.forEach((node) => {
          try {
            node.disconnect();
          } catch {
            // ignore cleanup errors
          }
        });
        mixSourceNodesRef.current = [];
        void mixContextRef.current?.close();
        mixContextRef.current = null;
        setIsSessionRecordingPaused(false);
        setIsSessionRecording(false);
      };

      recorder.start(1000);
      setIsSessionRecording(true);
      setIsSessionRecordingPaused(false);
    } catch {
      captureTapsRef.current.forEach((tap) => tap.dispose());
      captureTapsRef.current = [];
      mixSourceNodesRef.current.forEach((node) => {
        try {
          node.disconnect();
        } catch {
          // ignore cleanup errors
        }
      });
      mixSourceNodesRef.current = [];
      void mixContextRef.current?.close();
      mixContextRef.current = null;
      setRecordError("Could not start recording.");
    }
  }

  function pauseSessionRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      recordingPausedAtRef.current = Date.now();
      setIsSessionRecordingPaused(true);
    }
  }

  function resumeSessionRecording() {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      if (recordingPausedAtRef.current) {
        recordingPausedMsRef.current += Date.now() - recordingPausedAtRef.current;
      }
      recordingPausedAtRef.current = null;
      setIsSessionRecordingPaused(false);
    }
  }

  function stopSessionRecording() {
    if (recordingPausedAtRef.current) {
      recordingPausedMsRef.current += Date.now() - recordingPausedAtRef.current;
      recordingPausedAtRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.stop();
    }
  }

  function discardSessionRecording() {
    if (recordingBlobUrl) {
      URL.revokeObjectURL(recordingBlobUrl);
    }
    setRecordingBlobUrl(null);
    setRecordingName("");
    setRecordingDurationSeconds(0);
  }

  async function saveSessionRecording() {
    if (!recordingBlobUrl || !session) return;

    const id = crypto.randomUUID();
    let storageUrl: string | null = null;
    try {
      storageUrl = await saveBlobUrlAsRecording(id, recordingBlobUrl);
    } catch {
      storageUrl = null;
    }

    addRecording({
      id,
      uid: "",
      name: recordingName.trim() || `${session.name} · ${new Date().toLocaleDateString()}`,
      durationSeconds: recordingDurationSeconds,
      createdAt: new Date(),
      storageUrl,
      isFavorite: false,
      notes: "",
      tags: ["session", `session:${session.id}`],
      instrument: "other",
      blobUrl: recordingBlobUrl,
    });

    setRecordingBlobUrl(null);
    setRecordingName("");
    setRecordingDurationSeconds(0);
    router.push("/sessions");
  }

  if (!hasHydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/sessions" className="text-sm text-[#374151] hover:underline">← Sessions</Link>
        <LoaderState label="Loading session..." className="py-4 text-left" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/sessions" className="text-sm text-[#374151] hover:underline">← Sessions</Link>
        <EmptyState message="This session no longer exists." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/sessions" className="text-sm text-[#374151] hover:underline">← Sessions</Link>
        </div>

        <div>
          {!isSessionRecording ? (
            <Button
              size="sm"
              variant="outline"
              onClick={startSessionRecording}
              aria-label="Start session recording"
              disabled={Boolean(recordingBlobUrl)}
            >
              Record Session
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="surface"
                onClick={isSessionRecordingPaused ? resumeSessionRecording : pauseSessionRecording}
                aria-label={isSessionRecordingPaused ? "Resume session recording" : "Pause session recording"}
              >
                {isSessionRecordingPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={stopSessionRecording}
                aria-label="Stop session recording"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#fecaca] animate-pulse" aria-hidden="true" />
                  Stop Recording
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="p-3">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={session.name}
            onChange={(event) => updateSession(session.id, { name: event.target.value })}
            className="w-full rounded border border-[#d1d5db] bg-white px-3 py-1.5 text-base font-semibold text-[#111111]"
          />
        </div>
        {recordError && <p className="mt-2 text-xs text-[#b9382f]">{recordError}</p>}
      </Card>

      <Card className="p-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={activeTool === "harmonium" ? "primary" : "outline"} onClick={() => setActiveTool("harmonium")}>Harmonium</Button>
          <Button size="sm" variant={activeTool === "tabla" ? "primary" : "outline"} onClick={() => setActiveTool("tabla")}>Tabla</Button>
          <Button size="sm" variant={activeTool === "tanpura" ? "primary" : "outline"} onClick={() => setActiveTool("tanpura")}>Tanpura</Button>
        </div>
      </Card>

      {activeTool === "harmonium" ? <HarmoniumView /> : null}
      {activeTool === "tabla" ? <TablaView /> : null}
      {activeTool === "tanpura" ? <TanpuraView /> : null}

      {recordingBlobUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 p-4" role="presentation">
          <div className="w-full max-w-sm rounded border border-[#d9c8ae] bg-[#fffaf0] p-4 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="save-session-recording-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p id="save-session-recording-title" className="text-sm font-semibold text-[#111827]">Save recording</p>
                <p className="mt-0.5 text-xs text-[#6b7280]">Confirm this session recording before leaving.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={discardSessionRecording} aria-label="Discard recording">Close</Button>
            </div>
            <MiniAudioPlayer src={recordingBlobUrl} />
            <input
              autoFocus
              type="text"
              value={recordingName}
              onChange={(event) => setRecordingName(event.target.value)}
              placeholder="Recording name"
              className="mt-3 w-full rounded border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#8a5a2b] focus:outline-none"
            />
            <p className="mt-2 text-[11px] text-[#6b7280]">Duration: {Math.floor(recordingDurationSeconds / 60).toString().padStart(2, "0")}:{(recordingDurationSeconds % 60).toString().padStart(2, "0")}</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={discardSessionRecording}>Discard</Button>
              <Button size="sm" onClick={saveSessionRecording}>Save and go to Sessions</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
