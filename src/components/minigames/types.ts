import type { GameMemory } from "@/game/GameState";
import type { LevelConfig } from "@/game/levels/types";

export interface MinigameProps {
  level: LevelConfig;
  memory: GameMemory;
  dark: boolean;
  onComplete?: () => void;
}
