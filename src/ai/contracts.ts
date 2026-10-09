// Shared AI contract — agreed with the AI service developer.
// The real interpretation service must implement AIAdapter using these types.

export type QuestionType = "favorite_color" | "favorite_toy";

export type NormalizedColor =
  "red" | "blue" | "yellow" | "green" | "purple" | "pink" | "orange" | "other";

export type ToyCategory = "doll" | "teddy" | "dinosaur" | "car" | "robot" | "ball" | "other";

export type PuzzleVariant = "color_removed" | "toy_shadow";

export interface AIRequest {
  questionType: QuestionType;
  answer: string;
  memory: {
    favoriteColor?: NormalizedColor;
    favoriteToy?: ToyCategory;
  };
}

export interface AIResponse {
  questionType: QuestionType;
  normalizedColor?: NormalizedColor;
  normalizedToy?: ToyCategory;
  monsterLine: string;
  /**
   * Short, clean paraphrase of the answer (max 4 words, e.g. "Rex the dinosaur", "sky blue").
   * Omitted when the answer is offensive, nonsense or a prompt-injection attempt.
   * The UI must show this (or the category label) — never the raw player text.
   */
  displayAnswer?: string;
  puzzleVariant: PuzzleVariant;
  fallbackUsed: boolean;
}

export interface AIAdapter {
  interpretAnswer(request: AIRequest): Promise<AIResponse>;
}

// ── The Guest: adaptive monster ──
// During each blackout the model reads what the player did so far and picks
// what the monster does in the NEXT task, from a closed list the engine can
// apply safely (it never touches win conditions).

export type GuestAction =
  | "disturb_item" // nudges something the player already placed
  | "false_hint" // a wrong spot glows for a moment
  | "light_flicker" // the room's light stutters
  | "weak_flashlight" // the flashlight beam shrinks
  | "shadow" // a silhouette crosses the room
  | "none";

/** What the engine observed this run (and, if any, last run on this device). */
export interface GuestObservations {
  /** seconds spent on each finished task, in order */
  taskSeconds: number[];
  restarts: number;
  wrongDrops: number;
  /** label of the first hiding spot the player checked, e.g. "Behind the sofa" */
  firstHideSpot: string | null;
  wrongHideSpots: number;
  /** automatic blackouts suffered with the possessed toy */
  blackoutsSuffered: number;
  /** which light froze the possessed toy */
  lightUsed: "main" | "lamp" | "both" | null;
  secondsToFreeze: number | null;
  flashlightMisses: number;
  /** earlier runs on this device (0 = first time) */
  previousVisits: number;
}

export interface GuestRequest {
  /** actions the next task can apply — the model must pick one of these */
  allowedActions: GuestAction[];
  observations: GuestObservations;
  memory: {
    favoriteColor?: NormalizedColor;
    favoriteToy?: ToyCategory;
    /** answers from the previous run on this device, if any */
    lastRunColor?: NormalizedColor;
    lastRunToy?: ToyCategory;
  };
  /** what The Guest already noticed this run, so it doesn't repeat itself */
  alreadyNoticed: string[];
}

export interface GuestDecision {
  action: GuestAction;
  /** one whispered sentence shown at the start of the next task */
  line: string;
  /** short third-person note for the ending screen ("You check the sofa first.") */
  noticed: string;
  fallbackUsed: boolean;
}
