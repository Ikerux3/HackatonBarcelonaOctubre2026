// Shared AI contract — agreed with the AI service developer.
// The real interpretation service must implement AIAdapter using these types.

export type QuestionType = "favorite_color" | "favorite_toy";

export type NormalizedColor =
  | "red"
  | "blue"
  | "yellow"
  | "green"
  | "purple"
  | "pink"
  | "orange"
  | "other";

export type ToyCategory =
  | "doll"
  | "teddy"
  | "dinosaur"
  | "car"
  | "robot"
  | "ball"
  | "other";

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
  puzzleVariant: PuzzleVariant;
  fallbackUsed: boolean;
}

export interface AIAdapter {
  interpretAnswer(request: AIRequest): Promise<AIResponse>;
}
