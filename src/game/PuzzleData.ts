import type { NormalizedColor } from "@/ai/contracts";

// Deterministic puzzle content. The AI never mutates this data directly —
// it only selects which supported variant is applied to the fixed scene.

export interface ToyItem {
  id: string;
  label: string;
  color: NormalizedColor;
  /** css color used in the cozy scene */
  hex: string;
}

export const TOYS: ToyItem[] = [
  { id: "ball", label: "Ball", color: "red", hex: "#d95555" },
  { id: "blocks", label: "Blocks", color: "blue", hex: "#5b7fd9" },
  { id: "dolly", label: "Doll", color: "yellow", hex: "#d9b84a" },
  { id: "dino", label: "Dino", color: "green", hex: "#63a86b" },
];

export interface TableItem {
  id: string;
  label: string;
  color: NormalizedColor;
  hex: string;
  /** shape cue so the puzzle never relies on color alone */
  shape: "circle" | "rect" | "triangle" | "diamond";
}

export const TABLE_ITEMS: TableItem[] = [
  { id: "plate", label: "Plate", color: "yellow", hex: "#d9b84a", shape: "circle" },
  { id: "cup", label: "Cup", color: "red", hex: "#d95555", shape: "rect" },
  { id: "fork", label: "Fork", color: "blue", hex: "#5b7fd9", shape: "triangle" },
  { id: "napkin", label: "Napkin", color: "green", hex: "#63a86b", shape: "diamond" },
];

/** Colors that can appear on table items; "other" answers map to purple here. */
export function effectiveColor(color: NormalizedColor | undefined): NormalizedColor {
  if (!color || color === "other") return "purple";
  return color;
}
