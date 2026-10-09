import type { LevelConfig } from "./types";

export const TIDY_TOYS: LevelConfig = {
  id: "tidy_toys",
  title: "Tidy up the toys",
  type: "drag_to_target",
  instructions: "Drag every toy into the toy box",
  theme: "living_room",
  objects: [
    { id: "ball", label: "Ball", asset: "ball", color: "red", x: 18, y: 58, size: 18, targetId: "toy_box" },
    { id: "blocks", label: "Blocks", asset: "blocks", color: "blue", x: 48, y: 66, size: 18, targetId: "toy_box" },
    { id: "doll", label: "Doll", asset: "doll", color: "yellow", x: 20, y: 82, size: 18, targetId: "toy_box" },
    { id: "dino", label: "Dino", asset: "dino", color: "green", x: 50, y: 86, size: 18, targetId: "toy_box" },
  ],
  targets: [{ id: "toy_box", label: "Toys", shape: "box", x: 80, y: 78, w: 32, h: 20 }],
  success: { kind: "all_placed" },
  monster: { trigger: "on_complete", intervention: "none" },
  personalization: { source: "none", transform: "none" },
};

export const SET_TABLE: LevelConfig = {
  id: "set_table",
  title: "Set the table",
  type: "place_items",
  instructions: "Put each thing in its spot on the table",
  theme: "dining_room",
  objects: [
    { id: "plate", label: "Plate", asset: "plate", color: "yellow", x: 16, y: 84, size: 18, targetId: "spot_plate" },
    { id: "glass", label: "Glass", asset: "glass", color: "red", x: 39, y: 84, size: 18, targetId: "spot_glass" },
    { id: "fork", label: "Fork", asset: "fork", color: "blue", x: 62, y: 84, size: 18, targetId: "spot_fork" },
    { id: "napkin", label: "Napkin", asset: "napkin", color: "green", x: 85, y: 84, size: 18, targetId: "spot_napkin" },
  ],
  targets: [
    { id: "spot_fork", label: "Fork", shape: "rect", x: 24, y: 42, w: 16, h: 20 },
    { id: "spot_plate", label: "Plate", shape: "circle", x: 50, y: 42, w: 26, h: 20 },
    { id: "spot_glass", label: "Glass", shape: "circle", x: 76, y: 32, w: 18, h: 14 },
    { id: "spot_napkin", label: "Napkin", shape: "rect", x: 76, y: 52, w: 18, h: 14 },
  ],
  success: { kind: "all_placed" },
  monster: { trigger: "after_half", intervention: "disturb_item" },
  personalization: { source: "favorite_color", transform: "color_removed" },
};

export const BUILT_IN_LEVELS: LevelConfig[] = [TIDY_TOYS, SET_TABLE];

/** Which level plays at each task stage of the main story. */
export const STORY_LEVELS = { task_one: TIDY_TOYS, task_two: SET_TABLE } as const;
