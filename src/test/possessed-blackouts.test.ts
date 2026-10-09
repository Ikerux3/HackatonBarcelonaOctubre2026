import { describe, expect, it } from "vitest";

import {
  shouldAutoBlackout,
  type AutoBlackoutInput,
} from "@/components/minigames/TidyRolesMinigame";

const SAFE = 9000;
// the scripted blackout happened at t=0 and the player has been in the dark since
const base: AutoBlackoutInput = {
  now: 0,
  blackouts: 1,
  maxBlackouts: 3,
  safeWindowMs: SAFE,
  lightOn: true,
  possessedLit: false,
  draggingPossessed: false,
  lastBlackout: 0,
  lastLightOn: 0,
  lastDrop: 0,
};

describe("possessed toy automatic blackouts", () => {
  it("does not fire right after a light is switched on, even after a long time in the dark", () => {
    // 20 s in the dark, light switched on half a second ago
    expect(shouldAutoBlackout({ ...base, now: 20_500, lastLightOn: 20_000 })).toBe(false);
  });

  it("fires once a light has been on for the whole safe window without freezing the toy", () => {
    expect(shouldAutoBlackout({ ...base, now: 20_000 + SAFE, lastLightOn: 20_000 })).toBe(true);
  });

  it("never fires while the toy is frozen in the light or being dragged", () => {
    const late = { ...base, now: 60_000, lastLightOn: 20_000 };
    expect(shouldAutoBlackout({ ...late, possessedLit: true })).toBe(false);
    expect(shouldAutoBlackout({ ...late, draggingPossessed: true })).toBe(false);
  });

  it("never fires in the dark, right after a drop, or past the cap", () => {
    const late = { ...base, now: 60_000, lastLightOn: 20_000 };
    expect(shouldAutoBlackout({ ...late, lightOn: false })).toBe(false);
    expect(shouldAutoBlackout({ ...late, lastDrop: 59_000 })).toBe(false);
    expect(shouldAutoBlackout({ ...late, blackouts: 3 })).toBe(false);
  });
});
