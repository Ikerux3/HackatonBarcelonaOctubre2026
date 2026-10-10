import { describe, expect, it } from "vitest";

import { musicMelodyForCorruption, musicModeForCorruption } from "@/game/audio";
import { corruptionLevelForStage } from "@/game/corruption";

describe("corruption-driven music", () => {
  it("uses the same corruption arc as the visual layer", () => {
    expect(corruptionLevelForStage("task_one")).toBe(0);
    expect(corruptionLevelForStage("task_two")).toBe(1);
    expect(corruptionLevelForStage("task_three")).toBe(2);
    expect(corruptionLevelForStage("blackout_three")).toBe(3);
  });

  it("moves from C major to A minor as corruption rises", () => {
    expect(musicModeForCorruption(0)).toBe("C major");
    expect(musicModeForCorruption(1)).toBe("C major to A minor");
    expect(musicModeForCorruption(2)).toBe("A minor");
    expect(musicModeForCorruption(3)).toBe("A harmonic minor");

    expect(musicMelodyForCorruption(0)).toContain(523); // C
    expect(musicMelodyForCorruption(2)).toContain(440); // A
    expect(musicMelodyForCorruption(3)).toContain(831); // G-sharp leading tone
  });

  it("keeps every corruption melody aligned to the same loop length", () => {
    const lengths = ([0, 1, 2, 3] as const).map((level) => musicMelodyForCorruption(level).length);
    expect(new Set(lengths)).toEqual(new Set([16]));
  });
});
