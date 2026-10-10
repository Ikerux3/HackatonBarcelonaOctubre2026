import type { FoodCategory, NormalizedColor, ToyCategory } from "@/ai/contracts";

/** Fixed asset catalogue. Levels and the AI may only pick from this list. */
export const ASSETS = {
  ball: { emoji: "⚽", label: "Ball" },
  blocks: { emoji: "🧱", label: "Blocks" },
  doll: { emoji: "🪆", label: "Doll" },
  dino: { emoji: "🦖", label: "Dino" },
  teddy: { emoji: "🧸", label: "Teddy" },
  car: { emoji: "🚗", label: "Car" },
  robot: { emoji: "🤖", label: "Robot" },
  book: { emoji: "📕", label: "Book" },
  sock: { emoji: "🧦", label: "Sock" },
  plate: { emoji: "🍽️", label: "Plate" },
  glass: { emoji: "🥛", label: "Glass" },
  fork: { emoji: "🍴", label: "Fork" },
  spoon: { emoji: "🥄", label: "Spoon" },
  napkin: { emoji: "🧻", label: "Napkin" },
  pajamas: { emoji: "👚", label: "Pajamas" },
  toothbrush: { emoji: "🪥", label: "Toothbrush" },
  slippers: { emoji: "🥿", label: "Slippers" },
  // music box symbols (shape + color, so they read without sound or color vision)
  moon: { emoji: "🌙", label: "Moon" },
  star: { emoji: "⭐", label: "Star" },
  bell: { emoji: "🔔", label: "Bell" },
  heart: { emoji: "❤️", label: "Heart" },
  // mom's room: the clue objects on her nightstand and the marks drawn on them
  photo: { emoji: "🖼️", label: "Photo" },
  little_box: { emoji: "🎁", label: "Little box" },
  clock: { emoji: "⏰", label: "Clock" },
  flower: { emoji: "🌸", label: "Flower" },
  eye: { emoji: "👁️", label: "Eye" },
} as const;

export type AssetId = keyof typeof ASSETS;
export const ASSET_IDS = Object.keys(ASSETS) as AssetId[];

export const COLOR_HEX: Record<NormalizedColor, string> = {
  red: "#d95555",
  blue: "#5b7fd9",
  yellow: "#d9b84a",
  green: "#63a86b",
  purple: "#9a6fd0",
  pink: "#e08ab8",
  orange: "#e0904a",
  other: "#9a9a9a",
};
export const COLORS = Object.keys(COLOR_HEX) as NormalizedColor[];

/** Favorite food → what appears on the table (not one of the pieces to place). */
export const FOOD_EMOJI: Record<FoodCategory, string> = {
  pizza: "🍕",
  pasta: "🍝",
  burger: "🍔",
  soup: "🍲",
  cake: "🍰",
  ice_cream: "🍨",
  fruit: "🍎",
  chicken: "🍗",
  fish: "🐟",
  sushi: "🍣",
  cheese: "🧀",
  salad: "🥗",
  other: "🍲",
};

/** Toy categories → silhouette asset. Unknown toys fall back to the teddy. */
export const TOY_ASSET: Record<ToyCategory, AssetId> = {
  doll: "doll",
  teddy: "teddy",
  dinosaur: "dino",
  car: "car",
  robot: "robot",
  ball: "ball",
  other: "teddy",
};
