import type { GameStage } from "./GameState";

/** Shared presentation corruption: 0 clean -> 3 fully corrupted. */
export type CorruptionLevel = 0 | 1 | 2 | 3;

/**
 * The current game has stage-based visual corruption rather than a persistent
 * 0-100 stat. Keep the mapping in one place so art and music tell the same arc.
 */
export function corruptionLevelForStage(stage: GameStage): CorruptionLevel {
  switch (stage) {
    case "task_two":
    case "blackout_two":
    case "question_two":
      return 1;
    case "task_three":
      return 2;
    case "blackout_three":
    case "goodnight_whisper":
      return 3;
    default:
      return 0;
  }
}
