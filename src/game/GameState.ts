import type { FoodCategory, GuestDecision, NormalizedColor, ToyCategory } from "@/ai/contracts";
import {
  corduraStartingAt,
  freezeCordura,
  initialCordura,
  scareCordura,
  tickCordura,
  type Cordura,
  type CorduraLight,
} from "./cordura";

// Explicit game stages — one active stage at a time, no loose boolean flags.
export type GameStage =
  | "intro"
  | "intro_name" // mom types her goodbye and asks the player's name
  | "intro_leave" // mom finishes the sentence with the name and leaves
  | "task_one"
  | "blackout_one"
  | "question_one"
  | "task_two"
  | "blackout_two"
  | "question_two"
  | "task_music" // Minigame 03: the music box (Simon, song only visible in the dark)
  | "blackout_music" // lights out again, no question
  | "task_mom" // Minigame 04: mom's voice calls the child's name, locked in her room
  | "blackout_mom" // lights out again, no question: straight to bedtime
  | "task_three" // bedtime: flashlight, favorite toy evades
  | "blackout_three" // final blackout
  | "goodnight_whisper" // total darkness, the monster whispers the name once
  | "mom_returns" // lights on, the front door opens: mom is really home
  | "unsettling_detail" // cozy room, but the toy is on the table and the color is gone
  | "ending";

export interface GameMemory {
  favoriteColor?: NormalizedColor;
  favoriteToy?: ToyCategory;
  /** asked by the monster in the middle of the table-for-three task */
  favoriteFood?: FoodCategory;
  /** validated locally, session memory only — never sent to the AI */
  playerName?: string;
  /** mother's dress color: drawn once at Play, the same in the intro, the table and the ending */
  motherColor?: NormalizedColor;
}

export interface GameState {
  stage: GameStage;
  memory: GameMemory;
  /** last thing the monster said, shown during blackouts */
  monsterLine: string | null;
  /** AI-cleaned paraphrases (never the raw player text), reused in the ending */
  displayColor: string | null;
  displayToy: string | null;
  aiBusy: boolean;
  /** what The Guest decided to do in each later task (first decision wins) */
  guest: Partial<Record<GuestSlot, GuestDecision>>;
  /** Barra de Cordura: moves only inside minigames, frozen when the last one ends */
  cordura: Cordura;
}

/** Stages where a minigame is being played (the only ones where Cordura moves). */
export const TASK_STAGES: readonly GameStage[] = [
  "task_one",
  "task_two",
  "task_music",
  "task_mom",
  "task_three",
];
/** Leaving this task freezes Cordura for the ending (the bathroom/pajama one in the 5-level plan). */
const LAST_TASK: GameStage = "task_three";

/** Tasks The Guest plans for, during the blackout before them. */
export type GuestSlot = "task_two" | "task_music" | "task_mom" | "task_three";
export const GUEST_SLOTS: readonly GuestSlot[] = [
  "task_two",
  "task_music",
  "task_mom",
  "task_three",
];

export const initialGameState: GameState = {
  stage: "intro",
  memory: {},
  monsterLine: null,
  displayColor: null,
  displayToy: null,
  aiBusy: false,
  guest: {},
  cordura: initialCordura,
};

export type GameAction =
  /** `cordura`: QA start value for the bar (debug only) */
  | { type: "START"; motherColor?: NormalizedColor; cordura?: number }
  | { type: "SET_NAME"; name: string }
  | { type: "TASK_DONE" }
  | { type: "ADVANCE" } // blackout timers / monster dialogue continue
  | { type: "AI_REQUEST" }
  | {
      type: "AI_RESULT";
      monsterLine: string;
      normalizedColor?: NormalizedColor;
      normalizedToy?: ToyCategory;
      displayAnswer?: string;
    }
  | { type: "GUEST_DECISION"; slot: GuestSlot; decision: GuestDecision }
  /** a minigame learned something (e.g. the favorite food asked mid-task) */
  | { type: "REMEMBER"; favoriteFood: FoodCategory }
  /** time spent in the light or the dark of the current minigame */
  | { type: "CORDURA_TICK"; light: CorduraLight; ms: number }
  | { type: "FULL_SCARE" }
  | { type: "REPLAY" };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START":
      return {
        ...initialGameState,
        stage: "intro_name",
        memory: action.motherColor ? { motherColor: action.motherColor } : {},
        cordura: action.cordura !== undefined ? corduraStartingAt(action.cordura) : initialCordura,
      };

    case "SET_NAME":
      return state.stage === "intro_name"
        ? { ...state, stage: "intro_leave", memory: { ...state.memory, playerName: action.name } }
        : state;

    case "TASK_DONE": {
      const next: Partial<Record<GameStage, GameStage>> = {
        task_one: "blackout_one",
        task_two: "blackout_two",
        task_music: "blackout_music",
        task_mom: "blackout_mom",
        task_three: "blackout_three",
      };
      const stage = next[state.stage];
      if (!stage) return state;
      return state.stage === LAST_TASK
        ? { ...state, stage, cordura: freezeCordura(state.cordura) }
        : { ...state, stage };
    }

    case "ADVANCE": {
      switch (state.stage) {
        case "intro_leave":
          return { ...state, stage: "task_one" };
        case "blackout_one":
          return { ...state, stage: "question_one", monsterLine: null };
        case "blackout_two":
          return { ...state, stage: "question_two", monsterLine: null };
        case "question_one":
          // only reachable after AI_RESULT stored the color
          return state.memory.favoriteColor ? { ...state, stage: "task_two" } : state;
        case "question_two":
          return state.memory.favoriteToy
            ? { ...state, stage: "task_music", monsterLine: null }
            : state;
        case "blackout_music":
          return { ...state, stage: "task_mom", monsterLine: null };
        case "blackout_mom":
          return { ...state, stage: "task_three", monsterLine: null };
        case "blackout_three":
          return { ...state, stage: "goodnight_whisper" };
        case "goodnight_whisper":
          return { ...state, stage: "mom_returns" };
        case "mom_returns":
          return { ...state, stage: "unsettling_detail" };
        case "unsettling_detail":
          return { ...state, stage: "ending" };
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
        displayColor: action.normalizedColor ? (action.displayAnswer ?? null) : state.displayColor,
        displayToy: action.normalizedToy ? (action.displayAnswer ?? null) : state.displayToy,
      };
    }

    case "GUEST_DECISION":
      // a late live answer must not change a task that already started with the fallback
      return state.guest[action.slot]
        ? state
        : { ...state, guest: { ...state.guest, [action.slot]: action.decision } };

    case "REMEMBER":
      return { ...state, memory: { ...state.memory, favoriteFood: action.favoriteFood } };

    case "CORDURA_TICK":
      return TASK_STAGES.includes(state.stage)
        ? { ...state, cordura: tickCordura(state.cordura, action.light, action.ms) }
        : state;

    case "FULL_SCARE":
      return TASK_STAGES.includes(state.stage)
        ? { ...state, cordura: scareCordura(state.cordura) }
        : state;

    case "REPLAY":
      return initialGameState;

    default:
      return state;
  }
}

/** What The Guest learned this run, for the ending screen. */
export function guestNotes(state: Pick<GameState, "guest">): string[] {
  return GUEST_SLOTS.map((s) => state.guest[s]?.noticed).filter((n): n is string => !!n);
}

/** What the UI may show for each answer: AI paraphrase, else the category label. */
export function colorLabel(state: Pick<GameState, "displayColor" | "memory">): string {
  if (state.displayColor) return state.displayColor;
  const c = state.memory.favoriteColor;
  return c && c !== "other" ? c : "that color";
}
export function toyLabel(state: Pick<GameState, "displayToy" | "memory">): string {
  if (state.displayToy) return state.displayToy;
  const t = state.memory.favoriteToy;
  return t && t !== "other" ? `your ${t}` : "your toy";
}
