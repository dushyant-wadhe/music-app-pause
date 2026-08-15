"use client";

import { Card } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import { useFluteStore } from "@/store/useFluteStore";
import { useFluteEngine } from "../hooks/useFluteEngine";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "C"];

export function FluteView() {
  const { noteOn, noteOff } = useFluteEngine();
  const { volume, octave, activeNotes, setVolume, setOctave } = useFluteStore();
  const notes = NOTES.map((name, index) => `${name}${octave + (index === 12 ? 1 : 0)}`);
  const activeNote = Array.from(activeNotes)[0] ?? null;
  const fingering = activeNote ? (NOTES.indexOf(activeNote.replace(/\d$/, "")) + 1) % 7 : 0;
  return (
    <div className="flute-workspace mx-auto flex w-full max-w-xl flex-col gap-5 px-2 py-3 md:py-5">
      <div className="px-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">Riyaaz instrument</p>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">Bansuri</h1>
        <p className="mt-1 text-xs text-[#75685b]">A–K for notes · W, E, T, Y, U for komal/tivra notes.</p>
      </div>

      <section className="bansuri-stage" aria-label="Bansuri performance area">
        <div className="bansuri-note-readout" aria-live="polite">
          <span>{activeNote ? activeNote.replace("#", "♯") : "Ready"}</span>
          <small>{activeNote ? `Octave ${activeNote.slice(-1)}` : `Octave ${octave}`}</small>
        </div>
        <div className={`bansuri ${activeNote ? "is-playing" : ""}`} aria-hidden="true">
          <span className="bansuri-cork" />
          <span className="bansuri-embouchure" />
          <span className="bansuri-grain" />
          <div className="bansuri-holes">
            {Array.from({ length: 7 }, (_, index) => <span key={index} className={index < fingering ? "is-covered" : ""} />)}
          </div>
          <span className="bansuri-end" />
        </div>
        <p className="bansuri-caption">{activeNote ? "Fingering engaged" : "Select a note or use your keyboard"}</p>
      </section>

      <Card className="flute-fingering-panel">
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b512b]">Fingering notes</p>
        <div className="flute-note-ribbon">
          {notes.map((note) => {
            return <button
              key={note}
              type="button"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); noteOn(note, 1, `pointer:${event.pointerId}`); }}
              onPointerUp={(event) => noteOff(note, `pointer:${event.pointerId}`)}
              onPointerCancel={(event) => noteOff(note, `pointer:${event.pointerId}`)}
              onLostPointerCapture={(event) => noteOff(note, `pointer:${event.pointerId}`)}
              className={`flute-note-tab ${activeNotes.has(note) ? "is-active" : ""}`}
              aria-label={`Play ${note}`}
            >{note.replace("#", "♯")}</button>;
          })}
        </div>
      </Card>
      <Card className="flute-controls grid grid-cols-2 gap-4">
        <Slider label="Volume" value={Math.round(volume * 100)} min={0} max={100} onChange={(value) => setVolume(value / 100)} formatValue={(value) => `${value}%`} />
        <Slider label="Octave" value={octave} min={2} max={5} onChange={setOctave} formatValue={(value) => `Oct ${value}`} />
      </Card>
    </div>
  );
}
