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

export type SceneTheme = "living_room" | "dining_room" | "bedroom";
export const SCENE_THEMES: SceneTheme[] = ["living_room", "dining_room", "bedroom"];

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

export interface Point {
  x: number;
  y: number;
}

/** Optional object that flees the first time the light touches it. */
export interface EvasiveRule {
  objectId: string;
  /** candidate hiding spots, % of the scene; the farthest from the light is used */
  positions: Point[];
  /** monster whisper shown when it flees */
  whisper: string;
}

export interface FlashlightOptions {
  /** light radius, % of scene width */
  radius: number;
  evasive?: EvasiveRule;
}

/**
 * Dark scene + draggable flashlight; tap lit objects to collect them.
 * Has no target zones (targets: [], objects' targetId: "").
 * "placed" in success conditions means "collected".
 */
export interface FlashlightFindLevel extends LevelBase {
  type: "flashlight_find";
  flashlight: FlashlightOptions;
}

/** Role of the Nth toy put away — depends on ORDER of interaction, not on the toy. */
export type TidyRole = "plain" | "cushion" | "drawer";
export const TIDY_ROLES: TidyRole[] = ["plain", "cushion", "drawer"];

export interface TidyStep {
  role: TidyRole;
  /** short hint shown while this step is active */
  hint: string;
}

export interface TidyOptions {
  /** fixed seed for the demo; null = new random toys every run */
  seed: number | null;
  /** assets the toys are drawn from (needs at least one per object slot) */
  pool: AssetId[];
  /** one step per object slot, in order */
  steps: TidyStep[];
  /** where the cushion / drawer sit (% of scene) */
  cushion: Point;
  drawer: Point;
  /** monster line after the last toy (shown during the following blackout) */
  completeLine: string;
}

/**
 * Objects are SLOTS (positions/colors); their sprites are replaced by seeded picks from
 * `tidy.pool`. All slots go into the first "box" target.
 */
export interface TidyRolesLevel extends LevelBase {
  type: "tidy_roles";
  tidy: TidyOptions;
}

export type LevelConfig =
  DragToTargetLevel | PlaceItemsLevel | FlashlightFindLevel | TidyRolesLevel;
export type MinigameType = LevelConfig["type"];
export const MINIGAME_TYPES: MinigameType[] = [
  "drag_to_target",
  "place_items",
  "flashlight_find",
  "tidy_roles",
];
