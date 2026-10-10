import { describe, expect, it } from "vitest";

import { STORY_SLOTS } from "@/game/demoProfile";
import manifest from "@/game/levels/data/story.json";
import { BUILT_IN_LEVELS, LEVEL_FILE_ERRORS, STORY_LEVELS } from "@/game/levels/defaultLevels";
import { validateLevel } from "@/game/levels/validate";

// Guard for the team: run `bun run test` after adding or editing a file in
// src/game/levels/data — a broken level fails here instead of in the demo.
describe("level files", () => {
  it("every JSON level in src/game/levels/data is valid and has a unique id", () => {
    expect(LEVEL_FILE_ERRORS).toEqual({});
  });

  it("story.json points at existing, valid levels for every slot", () => {
    for (const slot of STORY_SLOTS) {
      const level = STORY_LEVELS[slot];
      expect(level.id, `story.${slot}`).toBe(manifest.story[slot]);
      expect(validateLevel(level).ok, `story.${slot} = "${level.id}"`).toBe(true);
    }
  });

  it("the editor lists every level, manifest order first", () => {
    expect(BUILT_IN_LEVELS.slice(0, manifest.editorOrder.length).map((l) => l.id)).toEqual(
      manifest.editorOrder,
    );
  });
});
