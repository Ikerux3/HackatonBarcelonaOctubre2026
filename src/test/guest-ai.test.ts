import { describe, expect, it } from "vitest";

import type { GuestDecision, GuestRequest } from "@/ai/contracts";
import { describeObservations, ruleGuestDecision } from "@/ai/guestFacts";
import { gameReducer, initialGameState } from "@/game/GameState";
import { allowedGuestActions, applyGuestAction } from "@/game/guestEffects";
import { BEDTIME, SET_TABLE, TIDY_TOYS } from "@/game/levels/defaultLevels";
import { validateLevel } from "@/game/levels/validate";

const request = (over: Partial<GuestRequest["observations"]> = {}): GuestRequest => ({
  allowedActions: allowedGuestActions(SET_TABLE),
  observations: {
    taskSeconds: [35],
    restarts: 0,
    wrongDrops: 0,
    firstHideSpot: null,
    wrongHideSpots: 0,
    blackoutsSuffered: 0,
    lightUsed: null,
    secondsToFreeze: null,
    flashlightMisses: 0,
    previousVisits: 0,
    ...over,
  },
  memory: {},
  alreadyNoticed: [],
});

describe("The Guest", () => {
  it("turns observations into facts the model can reference", () => {
    const facts = describeObservations(
      request({ firstHideSpot: "Behind the sofa", wrongHideSpots: 1, lightUsed: "lamp" }),
    );
    expect(facts.join(" ")).toContain('looked "behind the sofa" first');
    expect(facts.join(" ")).toContain("small lamp");
  });

  it("offline rules react to what the player did and only pick allowed actions", () => {
    const d = ruleGuestDecision(request({ firstHideSpot: "Behind the sofa" }));
    expect(allowedGuestActions(SET_TABLE)).toContain(d.action);
    expect(d.line).toContain("Behind the sofa");
    expect(d.fallbackUsed).toBe(true);

    const flash = ruleGuestDecision({
      ...request({ lightUsed: "lamp" }),
      allowedActions: allowedGuestActions(BEDTIME),
    });
    expect(flash.action).toBe("weak_flashlight");
  });

  it("remembers a returning player from the previous run on this device", () => {
    const d = ruleGuestDecision({
      ...request({ previousVisits: 1 }),
      memory: { lastRunColor: "blue" },
    });
    expect(d.line).toContain("You came back");
    expect(d.line).toContain("blue");
    expect(
      describeObservations({ ...request({ previousVisits: 1 }), memory: {} }).join(" "),
    ).toContain("been in this house before");
  });

  it("does not repeat what it already noticed", () => {
    const first = ruleGuestDecision(request({ firstHideSpot: "Behind the sofa" }));
    const second = ruleGuestDecision({
      ...request({ firstHideSpot: "Behind the sofa" }),
      alreadyNoticed: [first.noticed],
    });
    expect(second.noticed).not.toBe(first.noticed);
  });

  it("actions change the monster's behaviour but keep every level solvable", () => {
    const table = applyGuestAction(SET_TABLE, "false_hint");
    expect(table.monster.intervention).toBe("false_hint");
    expect(table.objects).toBe(SET_TABLE.objects);
    expect(table.success).toBe(SET_TABLE.success);
    expect(validateLevel(table).ok).toBe(true);

    const bed = applyGuestAction(BEDTIME, "weak_flashlight");
    expect(bed.type === "flashlight_find" && bed.flashlight.radius).toBeLessThan(
      BEDTIME.type === "flashlight_find" ? BEDTIME.flashlight.radius : 0,
    );
    expect(validateLevel(bed).ok).toBe(true);

    expect(applyGuestAction(TIDY_TOYS, "shadow")).toBe(TIDY_TOYS);
  });

  it("a late live decision never replaces the plan a task already started with", () => {
    const plan = (action: GuestDecision["action"]): GuestDecision => ({
      action,
      line: "x",
      noticed: "You x.",
      fallbackUsed: false,
    });
    const s1 = gameReducer(initialGameState, {
      type: "GUEST_DECISION",
      slot: "task_two",
      decision: plan("shadow"),
    });
    const s2 = gameReducer(s1, {
      type: "GUEST_DECISION",
      slot: "task_two",
      decision: plan("none"),
    });
    expect(s2.guest.task_two?.action).toBe("shadow");
  });
});
