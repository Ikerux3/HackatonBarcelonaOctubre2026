import type { AIAdapter, AIRequest, AIResponse } from "./contracts";
import { mockAdapter } from "./mockAdapter";

// Swap point for the real AI service. When the backend is ready, replace
// `mockAdapter` below with an HTTP client that calls the interpretation
// endpoint (server-side only — never expose API keys in frontend code).
//
// The game also wraps every call in a deterministic fallback so a failed
// or slow AI response can never block gameplay.

export const aiAdapter: AIAdapter = mockAdapter;

export async function interpretAnswerSafe(request: AIRequest): Promise<AIResponse> {
  try {
    const response = await aiAdapter.interpretAnswer(request);
    return response;
  } catch {
    // Deterministic fallback: the game must always remain completable.
    if (request.questionType === "favorite_color") {
      return {
        questionType: "favorite_color",
        normalizedColor: "other",
        monsterLine: "Hm. The dark has its own favorite color. It chose for you.",
        puzzleVariant: "color_removed",
        fallbackUsed: true,
      };
    }
    return {
      questionType: "favorite_toy",
      normalizedToy: "other",
      monsterLine: "It doesn't matter what it was. It's mine now.",
      puzzleVariant: "toy_shadow",
      fallbackUsed: true,
    };
  }
}
