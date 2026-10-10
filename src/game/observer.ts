import type { GuestObservations, NormalizedColor, ToyCategory } from "@/ai/contracts";
import { COLORS, TOY_ASSET } from "./levels/assets";

// What The Guest sees. Minigames report plain facts here; the AI reads a
// snapshot during each blackout. Session-only, plus a tiny per-device memory
// of the previous run (localStorage) so The Guest can remember returning players.

let obs: GuestObservations = fresh(0);
let taskStartedAt: number | null = null;
let possessedAt: number | null = null;
let lightsTouched = new Set<"main" | "lamp">();

function fresh(previousVisits: number): GuestObservations {
  return {
    taskSeconds: [],
    restarts: 0,
    wrongDrops: 0,
    firstHideSpot: null,
    wrongHideSpots: 0,
    blackoutsSuffered: 0,
    lightUsed: null,
    secondsToFreeze: null,
    flashlightMisses: 0,
    fullScares: 0,
    previousVisits,
  };
}

export const observe = {
  /** new run: clears the session, keeps the device memory */
  reset() {
    obs = fresh(loadGuestMemory().visits);
    taskStartedAt = null;
    possessedAt = null;
    lightsTouched = new Set();
  },
  taskStart() {
    taskStartedAt = Date.now();
  },
  taskEnd() {
    if (taskStartedAt === null) return;
    obs.taskSeconds.push(Math.round((Date.now() - taskStartedAt) / 1000));
    taskStartedAt = null;
  },
  restart() {
    obs.restarts += 1;
  },
  wrongDrop() {
    obs.wrongDrops += 1;
  },
  hideSpot(label: string, correct: boolean) {
    if (obs.firstHideSpot === null && label) obs.firstHideSpot = label.slice(0, 40);
    if (!correct) obs.wrongHideSpots += 1;
  },
  possessStart() {
    possessedAt = Date.now();
  },
  blackout() {
    obs.blackoutsSuffered += 1;
  },
  light(k: "main" | "lamp") {
    lightsTouched.add(k);
  },
  /** the possessed toy went into the box */
  possessDone() {
    if (possessedAt !== null) obs.secondsToFreeze = Math.round((Date.now() - possessedAt) / 1000);
    obs.lightUsed =
      lightsTouched.size === 2
        ? "both"
        : lightsTouched.has("lamp")
          ? "lamp"
          : lightsTouched.has("main")
            ? "main"
            : null;
  },
  flashlightMiss() {
    obs.flashlightMisses += 1;
  },
  /** stayed in the dark too long: the monster got them (counts as a relevant error) */
  fullScare() {
    obs.fullScares += 1;
  },
  snapshot(): GuestObservations {
    return { ...obs, taskSeconds: [...obs.taskSeconds] };
  },
};

// ── per-device memory of the previous run ──
const MEMORY_KEY = "mwbb.guest.memory.v1";

export interface GuestMemory {
  visits: number;
  lastColor?: NormalizedColor;
  lastToy?: ToyCategory;
}

export function loadGuestMemory(): GuestMemory {
  try {
    const raw = JSON.parse(
      localStorage.getItem(MEMORY_KEY) ?? "null",
    ) as Partial<GuestMemory> | null;
    const visits =
      typeof raw?.visits === "number" && raw.visits >= 0 ? Math.min(raw.visits, 999) : 0;
    return {
      visits,
      ...(raw?.lastColor && COLORS.includes(raw.lastColor) ? { lastColor: raw.lastColor } : {}),
      ...(raw?.lastToy && raw.lastToy in TOY_ASSET ? { lastToy: raw.lastToy } : {}),
    };
  } catch {
    return { visits: 0 };
  }
}

/** Called once per finished run. */
export function rememberRun(color?: NormalizedColor, toy?: ToyCategory) {
  try {
    const prev = loadGuestMemory();
    const next: GuestMemory = {
      visits: prev.visits + 1,
      ...(color ? { lastColor: color } : {}),
      ...(toy ? { lastToy: toy } : {}),
    };
    localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Dev/demo: forget the player (e.g. before handing the phone to the jury). */
export function forgetGuestMemory() {
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch {
    /* ignore */
  }
}
