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
