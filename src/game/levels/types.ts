import type { NormalizedColor, PuzzleVariant } from "@/ai/contracts";
import type { AssetId } from "./assets";

// Data-driven level schema. Levels are plain JSON — no executable code.
// Coordinates are normalized percentages (0–100) of the scene box, so a
// level renders identically on every screen size.

export interface SceneObject {
  id: string;
  label: string;
  asset: AssetId;
  color: NormalizedColor;
  /** center, % of scene width */
  x: number;
  /** center, % of scene height */
  y: number;
  /** tile size, % of scene width */
  size: number;
  /** id of the target zone this object belongs in */
  targetId: string;
}

export type TargetShape = "box" | "circle" | "rect";

export interface TargetZone {
  id: string;
  label: string;
  shape: TargetShape;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SuccessCondition = { kind: "all_placed" } | { kind: "min_placed"; count: number };

export type MonsterTrigger = "on_complete" | "after_half";
export type MonsterIntervention = "none" | "light_disturbance" | "disturb_item" | "false_hint";

export interface MonsterRule {
  trigger: MonsterTrigger;
  intervention: MonsterIntervention;
}

export type PersonalizationSource = "none" | "favorite_color" | "favorite_toy";

export interface Personalization {
  source: PersonalizationSource;
  transform: PuzzleVariant | "none";
}

export type SceneTheme = "living_room" | "dining_room";

interface LevelBase {
  id: string;
  title: string;
  instructions: string;
  theme: SceneTheme;
  objects: SceneObject[];
  targets: TargetZone[];
  success: SuccessCondition;
  monster: MonsterRule;
  personalization: Personalization;
}

/** Many objects into one container (they vanish into it). */
export interface DragToTargetLevel extends LevelBase {
  type: "drag_to_target";
}

/** Each object snaps into its own outlined spot and stays visible. */
export interface PlaceItemsLevel extends LevelBase {
  type: "place_items";
}

export type LevelConfig = DragToTargetLevel | PlaceItemsLevel;
export type MinigameType = LevelConfig["type"];
export const MINIGAME_TYPES: MinigameType[] = ["drag_to_target", "place_items"];
