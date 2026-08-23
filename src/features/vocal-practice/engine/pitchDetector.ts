/**
 * Vocal Practice — Pitch Detection Engine
 * Uses Web Audio API AnalyserNode + time-domain autocorrelation.
 * IMPROVED: Normalized SDF algorithm (more accurate than raw AC),
 * parabolic interpolation, and clarity hysteresis support.
 */

export interface PitchResult {
  frequency: number; // Hz
  clarity: number;   // 0–1, confidence
}

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

export async function getUserMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false, // OFF — AGC compresses soft singing, hurting clarity
    },
    video: false,
  });
}

export interface PitchDetectorHandle {
  analyser: AnalyserNode;
  sourceNode: MediaStreamAudioSourceNode;
  audioCtx: AudioContext;
  stop: () => void;
}

export function createPitchDetector(stream: MediaStream): PitchDetectorHandle {
  const audioCtx = getAudioCtx();
  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  // 4096 samples → better frequency resolution (≈ 10.7 Hz resolution at 44100 Hz)
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.0;
  sourceNode.connect(analyser);

  const stop = () => {
    try { sourceNode.disconnect(); } catch { /* already disconnected */ }
    stream.getTracks().forEach((t) => t.stop());
    // Close AudioContext to fully release mic
    if (audioCtx.state !== "closed") {
      audioCtx.close().catch(() => undefined);
      _audioCtx = null;
    }
  };

  return { analyser, sourceNode, audioCtx, stop };
}

/**
 * YIN-inspired pitch detection with NSDF (Normalized Square Difference Function).
 * More accurate than plain autocorrelation for voiced pitch detection.
 * Returns null if signal too quiet or pitch not confident.
 */
export function detectPitch(analyser: AnalyserNode): PitchResult | null {
  const bufferLength = analyser.fftSize;
  const buffer = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(buffer);

  // ── 1. RMS silence gate ──────────────────────────────────────────
  let rms = 0;
  for (let i = 0; i < bufferLength; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / bufferLength);
  if (rms < 0.008) return null; // slightly more sensitive than before

  const sampleRate = analyser.context.sampleRate;

  // ── 2. Normalized Square Difference Function (NSDF) ─────────────
  // NSDF(τ) = 2 * Σ r(τ) / (Σ m²(τ))
  // More immune to octave errors than raw autocorrelation.
  const W = bufferLength >> 1; // use first half only
  const nsdf = new Float32Array(W);

  let acf0 = 0;
  for (let i = 0; i < bufferLength; i++) acf0 += buffer[i] * buffer[i];

  let runningSum = acf0 * 2;

  for (let tau = 0; tau < W; tau++) {
    let acf = 0;
    for (let i = 0; i < bufferLength - tau; i++) {
      acf += buffer[i] * buffer[i + tau];
    }
    // Running sum of squared differences for denominator
    if (tau > 0) {
      runningSum -= buffer[tau - 1] * buffer[tau - 1]
                 + buffer[bufferLength - tau] * buffer[bufferLength - tau];
    }
    nsdf[tau] = runningSum > 0 ? (2 * acf) / runningSum : 0;
  }

  // ── 3. Find peaks in NSDF ────────────────────────────────────────
  const minFreq = 70;   // Hz — vocal floor (deep bass voice)
  const maxFreq = 1400; // Hz — top of singing range
  const minTau = Math.floor(sampleRate / maxFreq);
  const maxTau = Math.ceil(sampleRate / minFreq);

  // Collect positive-slope peaks
  let bestTau = -1;
  let bestValue = -Infinity;

  let wasNegative = nsdf[minTau] < 0;
  for (let tau = minTau + 1; tau < maxTau; tau++) {
    const v = nsdf[tau];
    // Crossing zero upwards — start of potential peak
    if (!wasNegative && nsdf[tau - 1] < 0) wasNegative = false;
    if (nsdf[tau - 1] < 0 && v >= 0) wasNegative = false;

    // Local maximum
    if (tau > minTau && v > nsdf[tau - 1] && (tau + 1 >= W || v >= nsdf[tau + 1])) {
      if (v > bestValue) {
        bestValue = v;
        bestTau = tau;
      }
    }
  }

  // Fallback: if no clear peak, use highest correlation in range
  if (bestTau === -1) {
    for (let tau = minTau; tau < maxTau; tau++) {
      if (nsdf[tau] > bestValue) { bestValue = nsdf[tau]; bestTau = tau; }
    }
  }

  if (bestTau < 1 || bestTau >= W - 1) return null;

  // ── 4. Parabolic interpolation (sub-sample accuracy) ────────────
  const y0 = nsdf[bestTau - 1];
  const y1 = nsdf[bestTau];
  const y2 = nsdf[bestTau + 1];
  const denominator = 2 * y1 - y0 - y2;
  const refinedTau = denominator !== 0
    ? bestTau + (y0 - y2) / (2 * denominator)
    : bestTau;

  const frequency = sampleRate / refinedTau;
  const clarity = bestValue; // NSDF peak value is already 0–1

  // ── 5. Quality gates ─────────────────────────────────────────────
  if (clarity < 0.60) return null; // slightly lower threshold → fewer gaps
  if (frequency < minFreq || frequency > maxFreq) return null;

  return { frequency, clarity };
}
