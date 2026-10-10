import { z } from "zod";

import {
  FOOD_CATEGORIES,
  type AIAdapter,
  type AIRequest,
  type AIResponse,
  type FoodCategory,
} from "./contracts";
import { interpretAnswerAI } from "./interpret.functions";

export const LIVE_TIMEOUT_MS = 5000;

const responseSchema = z.object({
  questionType: z.enum(["favorite_color", "favorite_toy", "favorite_food"]),
  normalizedColor: z
    .enum(["red", "blue", "yellow", "green", "purple", "pink", "orange", "other"])
    .optional(),
  normalizedToy: z.enum(["doll", "teddy", "dinosaur", "car", "robot", "ball", "other"]).optional(),
  normalizedFood: z.enum(FOOD_CATEGORIES as [FoodCategory, ...FoodCategory[]]).optional(),
  monsterLine: z.string().trim().min(1).max(140),
  displayAnswer: z.string().trim().min(1).max(40).optional(),
  puzzleVariant: z.enum(["color_removed", "toy_shadow", "food_shown"]),
  fallbackUsed: z.boolean(),
});

/** Real model inference via the server function. Throws on failure/timeout/invalid data. */
export const liveAdapter: AIAdapter = {
  async interpretAnswer(request: AIRequest): Promise<AIResponse> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout")), LIVE_TIMEOUT_MS),
    );
    const raw = await Promise.race([interpretAnswerAI({ data: request }), timeout]);
    const parsed = responseSchema.parse(raw);
    if (parsed.questionType !== request.questionType)
      throw new Error("AI answered the wrong question");
    return parsed as AIResponse;
  },
};
