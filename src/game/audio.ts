// Minimal WebAudio effects. Audio starts only after a user gesture
// (the Play button) and every helper is a no-op if the context failed.

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

// ---- music box loop (intro + first task), detunes a little more every bar ----
const MELODY = [784, 659, 523, 659, 784, 784, 784, 0, 698, 587, 494, 587, 698, 698, 698, 0];
const NOTE_MS = 360;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;
let detuneCents = 0;

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
    chime(MELODY[musicStep % MELODY.length]!, detuneCents);
    musicStep++;
    if (musicStep % MELODY.length === 0) detuneCents = Math.min(detuneCents + 12, 90);
  }, NOTE_MS);
}
/** progress-based detune floor (0 = in tune) */
export function setMusicDetune(cents: number): void {
  detuneCents = Math.max(detuneCents, cents);
}
export function stopMusicBox(reset = false): void {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (reset) {
    detuneCents = 0;
    musicStep = 0;
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

export const sfx = {
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
  knock: () => {
    [0, 260, 520, 1300, 1560].forEach((d) => setTimeout(() => tone(110, 0.09, "square", 0.08, 70), d));
  },
  door: () => {
    tone(90, 0.25, "sine", 0.09);
    setTimeout(() => tone(70, 0.4, "sine", 0.09), 300);
  },
};
