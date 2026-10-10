import type { FoodCategory } from "@/ai/contracts";
import type { GameMemory } from "@/game/GameState";
import type { LevelConfig } from "@/game/levels/types";

export interface MinigameProps {
  level: LevelConfig;
  memory: GameMemory;
  dark: boolean;
  onComplete?: () => void;
  /** a minigame that asks its own question stores the validated answer here */
  onRememberFood?: (food: FoodCategory) => void;
}
