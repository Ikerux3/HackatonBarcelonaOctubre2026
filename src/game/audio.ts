// Minimal WebAudio effects. Audio starts only after a user gesture
// (the Play button) and every helper is a no-op if the context failed.

import type { CorruptionLevel } from "./corruption";

let ctx: AudioContext | null = null;

export function initAudio(): void {
  if (ctx) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  } catch {
    ctx = null;
  }
}

/** iOS Safari starts contexts suspended; resume on every gesture-driven call. */
function resume(): void {
  try {
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
}

/** Haptics: guarded, silently no-op where unsupported (e.g. iPhone Safari). */
export function haptic(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
      navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

// ---- music box loop: C major slowly gives way to A minor as corruption rises ----
const MELODIES: Record<CorruptionLevel, readonly number[]> = {
  // C major: C-E-G followed by B-D-F tension resolving back toward C.
  0: [784, 659, 523, 659, 784, 784, 784, 0, 698, 587, 494, 587, 698, 698, 698, 0],
  // Pivot: the first phrase remains in C; the second establishes A-C-E.
  1: [784, 659, 523, 659, 784, 784, 784, 0, 659, 523, 440, 523, 659, 659, 659, 0],
  // A natural minor: same white-note collection, but A is now the tonal home.
  2: [659, 523, 440, 523, 659, 659, 659, 0, 698, 587, 440, 587, 698, 523, 440, 0],
  // A harmonic minor: G-sharp makes the final dominant pull more disturbing.
  3: [659, 523, 440, 523, 659, 659, 659, 0, 831, 659, 494, 659, 831, 659, 440, 0],
};

export const MUSIC_MODE_BY_CORRUPTION = [
  "C major",
  "C major to A minor",
  "A minor",
  "A harmonic minor",
] as const;

export function musicModeForCorruption(level: CorruptionLevel) {
  return MUSIC_MODE_BY_CORRUPTION[level];
}

export function musicMelodyForCorruption(level: CorruptionLevel): readonly number[] {
  return MELODIES[level];
}

const NOTE_MS = 360;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;
let ageDetuneCents = 0;
let requestedCorruption: CorruptionLevel = 0;
let activeCorruption: CorruptionLevel = 0;

const CORRUPTION_DETUNE_CENTS: Record<CorruptionLevel, number> = {
  0: 0,
  1: 8,
  2: 22,
  3: 42,
};

function chime(freq: number, cents: number): void {
  if (!ctx || !freq) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    // wobble grows with the detune: the box sounds older and older
    osc.detune.setValueAtTime(cents * (musicStep % 2 ? 1 : -0.6), t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  } catch {
    /* ignore */
  }
}

export function startMusicBox(): void {
  resume();
  if (!ctx || musicTimer) return;
  musicTimer = setInterval(() => {
    const melody = musicMelodyForCorruption(activeCorruption);
    if (musicStep % melody.length === 0) activeCorruption = requestedCorruption;
    const activeMelody = musicMelodyForCorruption(activeCorruption);
    const cents = Math.min(CORRUPTION_DETUNE_CENTS[activeCorruption] + ageDetuneCents, 90);
    chime(activeMelody[musicStep % activeMelody.length]!, cents);
    musicStep++;
    if (musicStep % activeMelody.length === 0) ageDetuneCents = Math.min(ageDetuneCents + 3, 18);
  }, NOTE_MS);
}

/** Changes mode on the next full melody loop, avoiding an abrupt mid-phrase modulation. */
export function setMusicCorruption(level: CorruptionLevel): void {
  requestedCorruption = level;
  if (!musicTimer) activeCorruption = level;
}

export function stopMusicBox(reset = false): void {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (reset) {
    ageDetuneCents = 0;
    musicStep = 0;
    requestedCorruption = 0;
    activeCorruption = 0;
  }
}

// ---- low ambient drone for dark stages ----
let drone: { stop: () => void } | null = null;

export function startDrone(): void {
  resume();
  if (!ctx || drone) return;
  try {
    const c = ctx;
    const t = c.currentTime;
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 2.5);
    const oscs = [43.65, 44.2, 65.4].map((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? "sine" : "sawtooth";
      o.frequency.value = f;
      o.connect(filter);
      o.start(t);
      return o;
    });
    filter.connect(gain).connect(c.destination);
    drone = {
      stop: () => {
        const n = c.currentTime;
        gain.gain.cancelScheduledValues(n);
        gain.gain.setValueAtTime(gain.gain.value, n);
        gain.gain.exponentialRampToValueAtTime(0.0001, n + 1.2);
        oscs.forEach((o) => o.stop(n + 1.3));
      },
    };
  } catch {
    drone = null;
  }
}
export function stopDrone(): void {
  try {
    drone?.stop();
  } catch {
    /* ignore */
  }
  drone = null;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gainValue: number,
  glideTo?: number,
): void {
  if (!ctx) return;
  resume();
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* audio is optional */
  }
}

/** Short tone panned left (-1) … right (1). */
function pannedTone(freq: number, duration: number, pan: number, glideTo?: number): void {
  if (!ctx) return;
  resume();
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo !== undefined)
      osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(p).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* audio is optional */
  }
}

export const sfx = {
  /** distorted, slowed-down giggle for the possessed toy */
  possessed: () => {
    haptic([120, 80, 120]);
    tone(160, 1.4, "sawtooth", 0.06, 52);
    [0, 220, 440].forEach((d, i) =>
      setTimeout(() => tone(420 - i * 70, 0.3, "square", 0.025, 300 - i * 60), 300 + d),
    );
  },
  lightSwitch: () => tone(2000, 0.03, "square", 0.05),
  /** squeaky toy noise coming from one side of the room (x in %) */
  squeak: (x: number) => {
    const pan = (x - 50) / 50;
    pannedTone(900, 0.12, pan, 1300);
    setTimeout(() => pannedTone(1100, 0.14, pan, 760), 150);
  },
  click: () => tone(1200, 0.06, "square", 0.04),
  success: () => {
    tone(523, 0.12, "sine", 0.06);
    setTimeout(() => tone(784, 0.18, "sine", 0.06), 110);
  },
  blackout: () => {
    haptic([90, 60, 220]);
    tone(180, 0.9, "sawtooth", 0.07, 40);
  },
  snap: () => {
    tone(660, 0.08, "triangle", 0.07);
    setTimeout(() => tone(990, 0.1, "triangle", 0.05), 60);
  },
  wrong: () => {
    haptic(60);
    tone(140, 0.25, "sine", 0.07, 90);
  },
  hum: () => tone(55, 2.4, "sine", 0.05),
  /** Two anxious beats; optional sound, never blocks subtitles. */
  heartbeat: () => {
    tone(58, 0.18, "sine", 0.075, 45);
    setTimeout(() => tone(50, 0.15, "sine", 0.055, 40), 230);
  },
  /** foreshadowing: a short, slightly wrong music-box phrase */
  odd: () => {
    [880, 830, 622, 587].forEach((f, i) =>
      setTimeout(() => tone(f, 0.5, "sine", 0.05, f * 0.97), i * 170),
    );
  },
  knock: () => {
    [0, 260, 520, 1300, 1560].forEach((d) =>
      setTimeout(() => tone(110, 0.09, "square", 0.08, 70), d),
    );
  },
  door: () => {
    tone(90, 0.25, "sine", 0.09);
    setTimeout(() => tone(70, 0.4, "sine", 0.09), 300);
  },
};
