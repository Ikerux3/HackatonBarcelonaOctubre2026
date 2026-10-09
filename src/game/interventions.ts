import type { NormalizedColor } from "@/ai/contracts";
import type { GameMemory } from "./GameState";
import { TOY_ASSET, type AssetId } from "./levels/assets";
import type { LevelConfig } from "./levels/types";

// Local, deterministic mapping layer. The AI contract stays untouched:
// normalized answers in memory select from these predefined interventions.

export interface ActiveInterventions {
  /** COLOR_THEFT: objects of this color are drained to shadow (shape/label kept) */
  colorTheft: NormalizedColor | null;
  /** TOY_ECHO: silhouette of the favorite toy */
  toyEcho: AssetId | null;
  /** PERSONAL_MEMORY: short whisper referencing an answer */
  memoryLine: string | null;
  /** LIGHT_DISTURBANCE: gentle dimming that never hides targets for long */
  lightDisturbance: boolean;
  /** monster nudges a placed item (it stays placed) */
  disturbItem: boolean;
  /** FALSE_HINT: a wrong spot glows briefly, then the true hints return */
  falseHint: boolean;
  afterHalf: boolean;
  /** flashlight_find + toy_shadow: the evasive object becomes the player's own toy */
  evasiveAsset: AssetId | null;
}

/** Colors the stock objects use; other answers map onto one so theft is always visible. */
export function theftColor(c: NormalizedColor): NormalizedColor {
  const map: Partial<Record<NormalizedColor, NormalizedColor>> = {
    pink: "red",
    orange: "yellow",
    purple: "blue",
    other: "green",
  };
  return map[c] ?? c;
}

export function resolveInterventions(
  level: LevelConfig,
  memory: GameMemory,
  dark: boolean,
): ActiveInterventions {
  const { source, transform } = level.personalization;
  const colorTheft =
    dark && source === "favorite_color" && transform === "color_removed" && memory.favoriteColor
      ? theftColor(memory.favoriteColor)
      : null;
  const toyEcho =
    source === "favorite_toy" && transform === "toy_shadow" && memory.favoriteToy
      ? TOY_ASSET[memory.favoriteToy]
      : null;
  const memoryLine = colorTheft
    ? `You like ${memory.favoriteColor}… I took it.`
    : toyEcho
      ? "I brought a friend. You remember it."
      : null;
  const iv = level.monster.intervention;
  return {
    colorTheft,
    toyEcho,
    memoryLine,
    lightDisturbance: dark && iv === "light_disturbance",
    disturbItem: iv === "disturb_item",
    falseHint: iv === "false_hint",
    afterHalf: level.monster.trigger === "after_half",
    evasiveAsset: level.type === "flashlight_find" && level.flashlight.evasive ? toyEcho : null,
  };
}
