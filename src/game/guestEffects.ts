import type { GuestAction } from "@/ai/contracts";
import type { LevelConfig, MonsterIntervention } from "./levels/types";

// How The Guest's chosen action lands in a level. Only cosmetic or reversible
// effects: objects, targets and success conditions are never touched, so every
// level stays solvable whatever the model picks.

/** Actions each minigame type can actually show. The model may only pick from these. */
export function allowedGuestActions(level: LevelConfig): GuestAction[] {
  switch (level.type) {
    case "drag_to_target":
    case "place_items":
      return ["disturb_item", "false_hint", "light_flicker", "shadow", "none"];
    case "flashlight_find":
      return ["weak_flashlight", "light_flicker", "shadow", "none"];
    default:
      return ["light_flicker", "shadow", "none"];
  }
}

const DRAG_INTERVENTION: Partial<Record<GuestAction, MonsterIntervention>> = {
  disturb_item: "disturb_item",
  false_hint: "false_hint",
  light_flicker: "light_disturbance",
};

/** Level-side part of the action (the drag engine and the flashlight read these). */
export function applyGuestAction(level: LevelConfig, action: GuestAction): LevelConfig {
  if (level.type === "drag_to_target" || level.type === "place_items") {
    const intervention = DRAG_INTERVENTION[action];
    return intervention ? { ...level, monster: { ...level.monster, intervention } } : level;
  }
  if (level.type === "flashlight_find" && action === "weak_flashlight") {
    const radius = Math.max(14, Math.round(level.flashlight.radius * 0.7));
    return { ...level, flashlight: { ...level.flashlight, radius } };
  }
  return level;
}

/** Overlay part of the action (drawn on top of any minigame by GameScreen). */
export function guestOverlay(level: LevelConfig, action: GuestAction) {
  const dragEngine = level.type === "drag_to_target" || level.type === "place_items";
  return {
    shadow: action === "shadow",
    // the drag engine already renders light_disturbance itself
    flicker: action === "light_flicker" && !dragEngine,
  };
}
