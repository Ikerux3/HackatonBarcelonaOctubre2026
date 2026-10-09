import { getAIMode, getScriptedLines } from "./aiMode";
import type { AIAdapter, AIRequest, AIResponse } from "./contracts";
import { liveAdapter } from "./liveAdapter";
import { mockAdapter } from "./mockAdapter";

// Mode switch: live (real AI, default) | mock (offline keywords) | scripted (fixed demo lines).
// Live falls back to the mock on error, >4s, or invalid JSON — gameplay never blocks.

/** Scripted: mock normalization (so color theft still works) + fixed lines from /editor. */
const scriptedAdapter: AIAdapter = {
  async interpretAnswer(request) {
    const base = await mockAdapter.interpretAnswer(request);
    return { ...base, monsterLine: getScriptedLines()[request.questionType] };
  },
};

export function currentAdapter(): AIAdapter {
  const mode = getAIMode();
  return mode === "mock" ? mockAdapter : mode === "scripted" ? scriptedAdapter : liveAdapter;
}

export async function interpretAnswerSafe(request: AIRequest): Promise<AIResponse> {
  const req = { ...request, answer: request.answer.slice(0, 60) };
  try {
    return await currentAdapter().interpretAnswer(req);
  } catch (err) {
    console.warn("[ai] falling back to mock:", (err as Error).message);
  }
  try {
    return { ...(await mockAdapter.interpretAnswer(req)), fallbackUsed: true };
  } catch {
    // Last-resort deterministic fallback.
    return request.questionType === "favorite_color"
      ? {
          questionType: "favorite_color",
          normalizedColor: "other",
          monsterLine: "Hm. The dark has its own favorite color. It chose for you.",
          puzzleVariant: "color_removed",
          fallbackUsed: true,
        }
      : {
          questionType: "favorite_toy",
          normalizedToy: "other",
          monsterLine: "It doesn't matter what it was. It's mine now.",
          puzzleVariant: "toy_shadow",
          fallbackUsed: true,
        };
  }
}
