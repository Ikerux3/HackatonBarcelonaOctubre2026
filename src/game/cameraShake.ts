import { useCallback, useEffect, useRef, useState } from "react";

/** Burst size: 1 small · 2 medium · 3 strong. */
export type ShakeLevel = 1 | 2 | 3;

const DURATION_MS: Record<ShakeLevel, number> = { 1: 350, 2: 500, 3: 700 };
/** minimum pause between two bursts — the screen never trembles continuously */
export const SHAKE_PAUSE_MS = 1200;
const MAX_TENSION = 6;

/** Bursts get one level stronger every 2 points of tension, capped at 3. */
export function shakeLevelFor(base: ShakeLevel, tension: number): ShakeLevel {
  return Math.min(3, base + Math.floor(Math.max(0, tension) / 2)) as ShakeLevel;
}

/**
 * Camera shake for ONE minigame (team rule, 10 oct): tension only grows while this
 * minigame is mounted — scares, blackouts and the monster's moves raise it — and
 * makes later bursts stronger. Bursts are short and rate-limited. When the next
 * minigame mounts it gets a fresh hook, so the shake stops and starts again at zero.
 */
export function useCameraShake() {
  const [burst, setBurst] = useState<ShakeLevel | null>(null);
  const tension = useRef(0);
  const lastAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const shake = useCallback((base: ShakeLevel) => {
    const now = Date.now();
    if (now - lastAt.current < SHAKE_PAUSE_MS) return;
    lastAt.current = now;
    const level = shakeLevelFor(base, tension.current);
    setBurst(level);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBurst(null), DURATION_MS[level]);
  }, []);

  const raiseTension = useCallback((amount = 1) => {
    tension.current = Math.min(MAX_TENSION, tension.current + amount);
  }, []);

  return { shakeClass: burst ? `game-cam-shake-${burst}` : "", shake, raiseTension };
}
