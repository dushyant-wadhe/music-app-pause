/**
 * Vocal Practice — Sargam + Pitch Utility Functions
 * Converts Hz → MIDI → sargam labels and calculates cents deviation.
 */

import type { RootNote } from "@/types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const SARGAM_BY_DEGREE = [
  "Sa", "Re♭", "Re", "Ga♭", "Ga", "Ma", "Ma#",
  "Pa", "Dha♭", "Dha", "Ni♭", "Ni",
] as const;

const SARGAM_SHORT = [
  "Sa", "r", "Re", "g", "Ga", "Ma", "M#",
  "Pa", "d", "Dha", "n", "Ni",
] as const;

/** Note semitone index for a given root (C=0, C#=1 ... B=11) */
const ROOT_SEMITONE: Record<RootNote, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

export interface NoteInfo {
  midi: number;
  octave: number;
  noteName: string;       // e.g. "C4"
  westernName: string;    // e.g. "C"
  sargam: string;         // e.g. "Sa"
  sargamShort: string;    // e.g. "Sa"
}

/** Convert frequency in Hz to MIDI note number (A4 = 69 = 440 Hz) */
export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

/** Round MIDI float to nearest semitone and return note info */
export function midiToNoteInfo(midi: number, rootNote: RootNote = "C"): NoteInfo {
  const rounded = Math.round(midi);
  const semitone = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const westernName = NOTE_NAMES[semitone];
  const rootSemi = ROOT_SEMITONE[rootNote];
  const degree = (semitone - rootSemi + 12) % 12;

  return {
    midi: rounded,
    octave,
    noteName: `${westernName}${octave}`,
    westernName,
    sargam: SARGAM_BY_DEGREE[degree],
    sargamShort: SARGAM_SHORT[degree],
  };
}

/**
 * Returns cents deviation from the nearest semitone.
 * Negative = flat, positive = sharp. Range: -50 to +50.
 */
export function centsDeviation(midiFloat: number): number {
  const nearest = Math.round(midiFloat);
  return Math.round((midiFloat - nearest) * 100);
}

/** Accuracy label based on cents offset */
export function pitchLabel(cents: number): "flat" | "sharp" | "on" {
  if (cents < -15) return "flat";
  if (cents > 15) return "sharp";
  return "on";
}

/** Get the frequency of a specific MIDI note */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Return the MIDI number for sargam degree + octave, relative to root */
export function sargamDegreeToMidi(
  degree: number,   // 0=Sa, 2=Re, 4=Ga ...
  rootNote: RootNote,
  octave = 4,
): number {
  const rootSemi = ROOT_SEMITONE[rootNote];
  return (octave + 1) * 12 + rootSemi + degree;
}

/**
 * Standard 12-degree sargam sequence with semitone intervals.
 * Only the "natural" 7 swaras for exercises: Sa Re Ga Ma Pa Dha Ni
 */
export const NATURAL_SWARAS: Array<{ label: string; degree: number }> = [
  { label: "Sa", degree: 0 },
  { label: "Re", degree: 2 },
  { label: "Ga", degree: 4 },
  { label: "Ma", degree: 5 },
  { label: "Pa", degree: 7 },
  { label: "Dha", degree: 9 },
  { label: "Ni", degree: 11 },
];
