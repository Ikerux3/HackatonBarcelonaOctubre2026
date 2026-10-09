import type { NormalizedColor, ToyCategory } from "@/ai/contracts";

// Explicit game stages — one active stage at a time, no loose boolean flags.
export type GameStage =
  | "intro"
  | "task_one"
  | "blackout_one"
  | "question_one"
  | "task_two"
  | "blackout_two"
  | "question_two"
  | "ending";

export interface GameMemory {
  favoriteColor?: NormalizedColor;
  favoriteToy?: ToyCategory;
}

export interface GameState {
  stage: GameStage;
  memory: GameMemory;
  /** last thing the monster said, shown during blackouts */
  monsterLine: string | null;
  /** raw answers, reused in the ending */
  rawColorAnswer: string | null;
  rawToyAnswer: string | null;
  aiBusy: boolean;
}

export const initialGameState: GameState = {
  stage: "intro",
  memory: {},
  monsterLine: null,
  rawColorAnswer: null,
  rawToyAnswer: null,
  aiBusy: false,
};

export type GameAction =
  | { type: "START" }
  | { type: "TASK_ONE_DONE" }
  | { type: "TASK_TWO_DONE" }
  | { type: "ADVANCE" } // blackout timers / monster dialogue continue
  | { type: "AI_REQUEST" }
  | {
      type: "AI_RESULT";
      monsterLine: string;
      normalizedColor?: NormalizedColor;
      normalizedToy?: ToyCategory;
      rawAnswer: string;
    }
  | { type: "REPLAY" };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START":
      return { ...initialGameState, stage: "task_one" };

    case "TASK_ONE_DONE":
      return state.stage === "task_one" ? { ...state, stage: "blackout_one" } : state;

    case "TASK_TWO_DONE":
      return state.stage === "task_two" ? { ...state, stage: "blackout_two" } : state;

    case "ADVANCE": {
      switch (state.stage) {
        case "blackout_one":
          return { ...state, stage: "question_one", monsterLine: null };
        case "blackout_two":
          return { ...state, stage: "question_two", monsterLine: null };
        case "question_one":
          // only reachable after AI_RESULT stored the color
          return state.memory.favoriteColor ? { ...state, stage: "task_two" } : state;
        case "question_two":
          return state.memory.favoriteToy ? { ...state, stage: "ending" } : state;
        default:
          return state;
      }
    }

    case "AI_REQUEST":
      return { ...state, aiBusy: true };

    case "AI_RESULT": {
      const memory: GameMemory = { ...state.memory };
      if (action.normalizedColor) memory.favoriteColor = action.normalizedColor;
      if (action.normalizedToy) memory.favoriteToy = action.normalizedToy;
      return {
        ...state,
        aiBusy: false,
        memory,
        monsterLine: action.monsterLine,
        rawColorAnswer: action.normalizedColor ? action.rawAnswer : state.rawColorAnswer,
        rawToyAnswer: action.normalizedToy ? action.rawAnswer : state.rawToyAnswer,
      };
    }

    case "REPLAY":
      return initialGameState;

    default:
      return state;
  }
}
