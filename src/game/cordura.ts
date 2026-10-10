import { createContext, useContext, useEffect, useRef } from "react";

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
  darkMsPerPoint: 1000,
  darkPointsPerInterval: 3,
  /** −1 for every 3 s with the light on (MJ's D36, ratified by Iker in D43) */
  litMsPerPoint: 2000,
  /** D34: 0–64 mom finds the child a little scared · 65–100 crying and very scared */
  cryingFrom: 65,
  /**
   * D44 "evento 100": reaching the max triggers ONE full scare (phase reset). It can only
   * happen again once the light has brought the bar down to this value — staying at 100
   * never chains scares. 90 = ~30 s with the light on. MJ may tune it after playtests.
   */
  rearmAt: 90,
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
  /** D44: true while reaching 100 would trigger the scare (re-armed at `rearmAt`) */
  armed100: boolean;
  /** how many "evento 100" scares happened this run — the screen reacts when it grows */
  events100: number;
}

export const initialCordura: Cordura = {
  value: 0,
  darkMs: 0,
  litMs: 0,
  final: null,
  armed100: true,
  events100: 0,
};

const clamp = (v: number) => Math.max(0, Math.min(CORDURA_RULES.max, v));

/** D44 latch: fire once at the top, re-arm only after the light brought it down. */
function latch100(c: Cordura): Cordura {
  if (c.armed100 && c.value >= CORDURA_RULES.max)
    return { ...c, armed100: false, events100: c.events100 + 1 };
  if (!c.armed100 && c.value <= CORDURA_RULES.rearmAt) return { ...c, armed100: true };
  return c;
}

/** `ms` spent in the light or in the dark. */
export function tickCordura(c: Cordura, light: CorduraLight, ms: number): Cordura {
  if (c.final !== null || ms <= 0) return c;
  if (light === "dark") {
    const banked = c.darkMs + ms;
    const points = Math.floor(banked / CORDURA_RULES.darkMsPerPoint);
    const value = clamp(c.value + points * CORDURA_RULES.darkPointsPerInterval);
    // at the top nothing is banked: the light starts bringing it down right away
    const darkMs = value === CORDURA_RULES.max ? 0 : banked - points * CORDURA_RULES.darkMsPerPoint;
    return latch100({ ...c, value, darkMs });
  }
  const banked = c.litMs + ms;
  const points = Math.floor(banked / CORDURA_RULES.litMsPerPoint);
  const value = clamp(c.value - points);
  // at zero the light can't bank "credit" for later darkness
  const litMs = value === 0 ? 0 : banked - points * CORDURA_RULES.litMsPerPoint;
  return latch100({ ...c, value, litMs });
}

/**
 * A minigame's own full scare (+10). If it is what takes the bar to 100, it already IS the
 * scare D44 asks for: the latch is spent without firing a second, chained one.
 */
export function scareCordura(c: Cordura): Cordura {
  if (c.final !== null) return c;
  const value = clamp(c.value + CORDURA_RULES.fullScare);
  return latch100({ ...c, value });
}

/** Dev/QA start value (`?debug=1&cordura=95`), so the 100 event can be tested quickly. */
export function corduraStartingAt(value: number): Cordura {
  return { ...initialCordura, value: clamp(Math.round(value)) };
}

/** At 100% start the SAME level again at 50%; earlier story memory is retained. */
export function resetCorduraAtCheckpoint(c: Cordura): Cordura {
  return { ...c, value: 50, darkMs: 0, litMs: 0, armed100: true, final: null };
}

/** The final 6-second darkness is exceptional: exactly +5, with NO 100% restart. */
export function freezeFinalCordura(c: Cordura): Cordura {
  if (c.final !== null) return c;
  const value = clamp(c.value + 5);
  return { ...c, value, darkMs: 0, litMs: 0, final: value };
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
  /** the active minigame resets its CURRENT phase when the 100 event fires */
  onEvent100: (handler: () => void) => () => void;
}

const NOOP: CorduraReporter = {
  light: () => {},
  fullScare: () => {},
  onEvent100: () => () => {},
};

/** Provided by the game screen. Outside it (editor playtest) reports are ignored. */
export const CorduraContext = createContext<CorduraReporter>(NOOP);

/** Minigames call this with the light the player is in right now. */
export function useCorduraLight(light: CorduraLight | null) {
  const report = useContext(CorduraContext);
  useEffect(() => {
    report.light(light);
  }, [report, light]);
  useEffect(() => () => report.light(null), [report]);
}

export function useCorduraScare() {
  return useContext(CorduraContext).fullScare;
}

/**
 * D44: what this minigame does when the bar hits 100 — reset only its current phase,
 * keeping inventory and earlier progress. The game screen shows the scare itself.
 */
export function useCordura100(resetCurrentPhase: () => void) {
  const report = useContext(CorduraContext);
  const handler = useRef(resetCurrentPhase);
  handler.current = resetCurrentPhase;
  useEffect(() => report.onEvent100(() => handler.current()), [report]);
}
