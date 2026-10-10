import { describe, expect, it } from "vitest";

import { shakeLevelFor } from "@/game/cameraShake";
import { gameReducer, initialGameState } from "@/game/GameState";

// Team clarification, 10 oct 2026: progressive, limited shake per minigame;
// mom's dress color drawn once per run and kept everywhere.
describe("team rules (10 oct)", () => {
  it("shake bursts grow with this minigame's tension and cap at the strongest level", () => {
    expect(shakeLevelFor(1, 0)).toBe(1);
    expect(shakeLevelFor(1, 2)).toBe(2);
    expect(shakeLevelFor(2, 4)).toBe(3);
    expect(shakeLevelFor(3, 99)).toBe(3);
    // a new minigame starts from zero tension
    expect(shakeLevelFor(1, 0)).toBe(1);
  });

  it("mom's dress color is drawn at Play and kept for the whole run", () => {
    const s = gameReducer(initialGameState, { type: "START", motherColor: "purple" });
    expect(s.memory.motherColor).toBe("purple");
    const later = gameReducer(gameReducer(s, { type: "SET_NAME", name: "Unai" }), {
      type: "REMEMBER",
      favoriteFood: "pizza",
    });
    expect(later.memory.motherColor).toBe("purple");
    // a new run draws again
    expect(gameReducer(later, { type: "REPLAY" }).memory.motherColor).toBeUndefined();
  });
});
