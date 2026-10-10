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
export type TidyRole = "plain" | "cushion" | "drawer" | "possessed" | "hide_seek";
export const TIDY_ROLES: TidyRole[] = ["plain", "cushion", "drawer", "possessed", "hide_seek"];

/** Circle in scene %: x/y like everything else, r = % of scene WIDTH. */
export interface LightZone {
  x: number;
  y: number;
  r: number;
}

/** Scenes are 2:3, so 1% of height = 1.5% of width. */
export function zoneCovers(z: LightZone, p: Point): boolean {
  return Math.hypot(p.x - z.x, (p.y - z.y) * 1.5) <= z.r;
}

/** Role "possessed": the toy flees between dark slots and freezes when lit. */
export interface PossessedOptions {
  /** 3–4 dark slots, visited in order (keep neighbours free of furniture between them) */
  slots: Point[];
  /** wall switch hotspot + the zones the main light covers */
  mainSwitch: Point;
  mainZones: LightZone[];
  /** small lamp hotspot + the zones it covers */
  lamp: Point;
  lampZones: LightZone[];
  /** total blackouts including the scripted first one (1–3) */
  maxBlackouts: number;
  /** minimum ms between blackouts (and after any drop) — the safe window */
  safeWindowMs: number;
  /** ms between hops while the toy is in the dark */
  moveMs: number;
  /** ms without progress before the right light hotspot pulses */
  hintAfterMs: number;
  /** whisper on the scripted blackout */
  possessLine: string;
  /** whisper when it is put away */
  freezeLine: string;
}

export type HideSpotKind = "sofa" | "drawer" | "curtain";
export const HIDE_SPOT_KINDS: HideSpotKind[] = ["sofa", "drawer", "curtain"];

export interface HideSpot extends Point {
  label: string;
  kind: HideSpotKind;
}

/** Role "hide_seek": the monster hides the last toy in one seeded spot. */
export interface HideSeekOptions {
  spots: HideSpot[];
  hintAfterMs: number;
  hintLine: string;
  wrongLine: string;
}

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
  /** required when a step uses role "possessed" */
  possessed?: PossessedOptions;
  /** required when a step uses role "hide_seek" */
  hideSeek?: HideSeekOptions;
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

// ── table_for_three (Minigame 02 "La mesa para tres") ──

export type TableOwner = "child" | "mom";
export type TableSide = "left" | "right";
export type KitchenContainerKind = "cupboard" | "drawer";

/** A cupboard or drawer in the kitchen view; tapping it shows what's inside. */
export interface KitchenContainer {
  id: string;
  label: string;
  kind: KitchenContainerKind;
  /** box in % of the scene */
  x: number;
  y: number;
  w: number;
  h: number;
  /** object ids (the 6 pieces) and decoy ids it holds */
  contents: string[];
}

/** Giant piece in the kitchen: never collectable, never counts. Mom's guest's, not yours. */
export interface TableDecoy {
  id: string;
  label: string;
  asset: AssetId;
}

export interface TableOptions {
  containers: KitchenContainer[];
  decoys: TableDecoy[];
  /** owner of each object (piece): one plate, one glass, one cutlery each */
  owners: Record<string, TableOwner>;
  /** side of the table of each target (slot): one plate, glass and cutlery slot per side */
  sides: Record<string, TableSide>;
  /** where the child sits; "random" = new each run — the marks in the dark tell */
  childSide: TableSide | "random";
  /** child's pieces use the favorite color; this one if it's unknown */
  childFallbackColor: NormalizedColor;
  /** mother's dress color, picked at random each run (may match the child's) */
  motherColors: NormalizedColor[];
  doors: { toDining: Point; toKitchen: Point };
  lightSwitch: Point;
  /** ms with the light off before the eyes, the warning shake and the full scare */
  dark: { eyesMs: number; shakeMs: number; scareMs: number };
  /** correct pieces that make the checkpoint (and trigger the food question) */
  checkpointAt: number;
  food: { enabled: boolean; question: string };
  /** after leaving and coming back (or before the last check) the monster swaps two pieces */
  swap: { enabled: boolean };
  hints: {
    kitchen: string;
    dining: string;
    dark: string;
    finish: string;
    /** optional numbered steps shown once, the first time in the dining room */
    howTo?: string[];
  };
  lines: {
    decoy: string;
    needAll: string;
    wrong: string;
    scare: string;
    swap: string;
    final: string;
  };
}

/**
 * Kitchen → collect 6 pieces into the tray; dining → place them. The light shows the
 * table, the dark shows whose place is whose. Objects = the 6 pieces (asset plate/glass/fork);
 * targets = the 6 slots (a target's kind = the kind of the object that points at it).
 */
export interface TableForThreeLevel extends LevelBase {
  type: "table_for_three";
  table: TableOptions;
}

// ── music_box (Minigame 03 "La caja de música", Drive D38 → D41) ──

export interface MusicBoxOptions {
  /** symbols per round; each round's song starts with the previous one (D41: 3, 4, 5, 7) */
  rounds: number[];
  /** fixed song (object ids, at least as long as the last round); null = new every run */
  sequence: string[] | null;
  lightSwitch: Point;
  /** the winding key that stops the music once every round is done */
  key: Point;
  /** taps on the key that stop the music */
  keyTurns: number;
  /** in the dark, each symbol glows for showMs, then gapMs; the song repeats after loopPauseMs */
  showMs: number;
  gapMs: number;
  loopPauseMs: number;
  hints: { lit: string; dark: string; key: string };
  lines: { start: string; round: string; wrong: string; key: string; done: string };
}

/**
 * Simon in the dark: the song (which symbols glow, in order) can ONLY be seen with the
 * light off, and ONLY typed with the light on. Objects = the symbol buttons on the box
 * (any asset); targets = the box itself. Rounds already done are kept.
 */
export interface MusicBoxLevel extends LevelBase {
  type: "music_box";
  musicBox: MusicBoxOptions;
}

// ── mom_room (Minigame 04 "El cuarto de mamá", Drive D39 → D42/D45) ──

export interface MomRoomOptions {
  /** the mark drawn on each clue object, only visible in the dark (object id → asset) */
  marks: Record<string, AssetId>;
  /** the card on the vanity: the clue objects in order — the code is their marks in this order */
  order: string[];
  /** the drawer panel's buttons, in display order (must hold every mark; extras are decoys) */
  panel: AssetId[];
  /** hotspots, % of the scene */
  door: Point;
  wardrobe: Point;
  card: Point;
  drawer: Point;
  lightSwitch: Point;
  hints: { call: string; room: string; dark: string; key: string };
  /** `{name}` = the player's (locally validated) name — D45: first said by The Guest here */
  lines: {
    call: string;
    locked: string;
    card: string;
    tooDark: string;
    wrong: string;
    drawer: string;
    wardrobe: string;
    leaving: string;
    blackout: string;
  };
}

/**
 * The Guest calls with mom's voice and locks the child in her room. The marks on the clue
 * objects (objects) only show with the light OFF; the vanity card and the drawer panel only
 * work with the light ON. Code → drawer → key → door. Targets = the nightstand.
 */
export interface MomRoomLevel extends LevelBase {
  type: "mom_room";
  momRoom: MomRoomOptions;
}

export type LevelConfig =
  | DragToTargetLevel
  | PlaceItemsLevel
  | FlashlightFindLevel
  | TidyRolesLevel
  | TableForThreeLevel
  | MusicBoxLevel
  | MomRoomLevel;
export type MinigameType = LevelConfig["type"];
export const MINIGAME_TYPES: MinigameType[] = [
  "drag_to_target",
  "place_items",
  "flashlight_find",
  "tidy_roles",
  "table_for_three",
  "music_box",
  "mom_room",
];

/** Table pieces: plate / glass / cutlery, by asset. */
export type TableKind = "plate" | "glass" | "cutlery";
export function tableKind(asset: AssetId): TableKind | null {
  if (asset === "plate") return "plate";
  if (asset === "glass") return "glass";
  if (asset === "fork" || asset === "spoon") return "cutlery";
  return null;
}
