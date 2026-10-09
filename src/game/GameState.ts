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
  /** ids of toys tidied in task_one */
  toysTidied: string[];
  /** ids of items placed on the table in task_two */
  tableSet: string[];
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
  toysTidied: [],
  tableSet: [],
  memory: {},
  monsterLine: null,
  rawColorAnswer: null,
  rawToyAnswer: null,
  aiBusy: false,
};

export type GameAction =
  | { type: "START" }
  | { type: "TIDY_TOY"; id: string }
  | { type: "PLACE_ITEM"; id: string }
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

    case "TIDY_TOY": {
      if (state.stage !== "task_one" || state.toysTidied.includes(action.id)) return state;
      return { ...state, toysTidied: [...state.toysTidied, action.id] };
    }

    case "PLACE_ITEM": {
      if (state.stage !== "task_two" || state.tableSet.includes(action.id)) return state;
      return { ...state, tableSet: [...state.tableSet, action.id] };
    }

    case "ADVANCE": {
      switch (state.stage) {
        case "blackout_one":
          return { ...state, stage: "question_one" };
        case "question_one":
          // only reachable after AI_RESULT stored the color
          return state.memory.favoriteColor ? { ...state, stage: "task_two" } : state;
        case "blackout_two":
          return { ...state, stage: "question_two" };
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
