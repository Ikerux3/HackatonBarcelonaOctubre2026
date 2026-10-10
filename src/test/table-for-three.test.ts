import { describe, expect, it } from "vitest";

import { mockAdapter } from "@/ai/mockAdapter";
import {
  countCorrect,
  isCorrect,
  pickSwap,
  slotOwner,
  type TableCtx,
} from "@/components/minigames/TableForThreeMinigame";
import { levelById } from "@/game/levels/defaultLevels";
import { validateLevel } from "@/game/levels/validate";

const level = levelById("table_for_three");
const ctx = (childSide: "left" | "right"): TableCtx => {
  if (level.type !== "table_for_three") throw new Error("wrong level type");
  return { objects: level.objects, targets: level.targets, table: level.table, childSide };
};

describe("Minigame 02 — table for three", () => {
  it("the level file is valid", () => {
    expect(validateLevel(level).ok).toBe(true);
  });

  it("whose place is whose depends on the side the child sits on this run", () => {
    expect(slotOwner(ctx("left"), "slot_left_plate")).toBe("child");
    expect(slotOwner(ctx("right"), "slot_left_plate")).toBe("mom");
  });

  it("a piece is right only with the right kind AND the right owner", () => {
    const c = ctx("right"); // child sits on the right this time
    expect(isCorrect(c, "slot_right_plate", "child_plate")).toBe(true);
    expect(isCorrect(c, "slot_left_plate", "child_plate")).toBe(false); // mommy's place
    expect(isCorrect(c, "slot_right_glass", "child_plate")).toBe(false); // wrong kind
    const solved = {
      slot_right_plate: "child_plate",
      slot_right_glass: "child_glass",
      slot_right_cutlery: "child_cutlery",
      slot_left_plate: "mom_plate",
      slot_left_glass: "mom_glass",
      slot_left_cutlery: "mom_cutlery",
    };
    expect(countCorrect(c, solved)).toBe(6);
  });

  it("the monster swaps two pieces of the same kind across the table", () => {
    const c = ctx("left");
    expect(pickSwap(c, { slot_left_plate: "child_plate" })).toBeNull();
    const pair = pickSwap(c, { slot_left_plate: "child_plate", slot_right_plate: "mom_plate" });
    expect(pair?.sort()).toEqual(["slot_left_plate", "slot_right_plate"]);
  });

  it("food answers map to edible categories (offline fallback)", async () => {
    const pizza = await mockAdapter.interpretAnswer({
      questionType: "favorite_food",
      answer: "pizza con piña",
      memory: {},
    });
    expect(pizza.normalizedFood).toBe("pizza");
    const wheel = await mockAdapter.interpretAnswer({
      questionType: "favorite_food",
      answer: "a wheel",
      memory: {},
    });
    expect(wheel.normalizedFood).toBe("other");
  });
});
