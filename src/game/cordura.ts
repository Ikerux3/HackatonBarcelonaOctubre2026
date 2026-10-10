import { createContext, useContext, useEffect } from "react";

/**
 * Barra de CORDURA (Drive D28/D33/D34, 10 oct): 0–100, a HIGH value means the child is
 * more shaken. It only moves while the player is inside a minigame — questions, blackouts
 * and cutscenes pause it — and it is frozen when the last minigame ends: the ending reads
 * that frozen value, so the final blackout and mom's return never change it.
 */
export const CORDURA_RULES = {
  max: 100,
  /** a full scare (the monster got you) */
  fullScare: 10,
  /** +1 for every 2 s with the light off (D28 — never +1 per second) */
  darkMsPerPoint: 2000,
  /** −1 for every 3 s with the light on: MJ's proposed rate (D36), waiting for Iker's OK */
  litMsPerPoint: 3000,
  /** D34: 0–64 mom finds the child a little scared · 65–100 crying and very scared */
  cryingFrom: 65,
} as const;

/** What the player is in right now, as reported by the active minigame. */
export type CorduraLight = "lit" | "dark";
export type CorduraEnding = "scared" | "crying";

export interface Cordura {
  value: number;
  /** time banked towards the next point, so partial seconds add up instead of being lost */
  darkMs: number;
  litMs: number;
  /** set once when the last minigame ends; nothing changes the bar after that */
  final: number | null;
}

export const initialCordura: Cordura = { value: 0, darkMs: 0, litMs: 0, final: null };

const clamp = (v: number) => Math.max(0, Math.min(CORDURA_RULES.max, v));

/** `ms` spent in the light or in the dark. */
export function tickCordura(c: Cordura, light: CorduraLight, ms: number): Cordura {
  if (c.final !== null || ms <= 0) return c;
  if (light === "dark") {
    const banked = c.darkMs + ms;
    const points = Math.floor(banked / CORDURA_RULES.darkMsPerPoint);
    const value = clamp(c.value + points);
    // at the top nothing is banked: the light starts bringing it down right away
    const darkMs = value === CORDURA_RULES.max ? 0 : banked - points * CORDURA_RULES.darkMsPerPoint;
    return { ...c, value, darkMs };
  }
  const banked = c.litMs + ms;
  const points = Math.floor(banked / CORDURA_RULES.litMsPerPoint);
  const value = clamp(c.value - points);
  // at zero the light can't bank "credit" for later darkness
  const litMs = value === 0 ? 0 : banked - points * CORDURA_RULES.litMsPerPoint;
  return { ...c, value, litMs };
}

export function scareCordura(c: Cordura): Cordura {
  return c.final !== null ? c : { ...c, value: clamp(c.value + CORDURA_RULES.fullScare) };
}

/** Snapshot taken when the last minigame ends. */
export function freezeCordura(c: Cordura): Cordura {
  return c.final !== null ? c : { ...c, final: c.value };
}

/** The value the ending uses: the frozen snapshot, never the highest value reached. */
export const finalCordura = (c: Cordura) => c.final ?? c.value;

export const corduraEnding = (value: number): CorduraEnding =>
  value >= CORDURA_RULES.cryingFrom ? "crying" : "scared";

// ── minigame → game wiring ──

export interface CorduraReporter {
  /** null = not counting (a question, a cutscene, the task is done) */
  light: (light: CorduraLight | null) => void;
  fullScare: () => void;
}

const NOOP: CorduraReporter = { light: () => {}, fullScare: () => {} };

/** Provided by the game screen. Outside it (editor playtest) reports are ignored. */
export const CorduraContext = createContext<CorduraReporter>(NOOP);

/** Minigames call this with the light the player is in right now. */
export function useCorduraLight(light: CorduraLight | null) {
  const report = useContext(CorduraContext);
  useEffect(() => report.light(light), [report, light]);
  useEffect(() => () => report.light(null), [report]);
}

export function useCorduraScare() {
  return useContext(CorduraContext).fullScare;
}
