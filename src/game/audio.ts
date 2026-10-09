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

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gainValue: number,
  glideTo?: number,
): void {
  if (!ctx) return;
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
  blackout: () => tone(180, 0.9, "sawtooth", 0.07, 40),
  hum: () => tone(55, 2.4, "sine", 0.05),
  door: () => {
    tone(90, 0.25, "sine", 0.09);
    setTimeout(() => tone(70, 0.4, "sine", 0.09), 300);
  },
};
