import { getAIMode, getScriptedLines, type AIMode } from "./aiMode";
import type { AIAdapter, AIRequest, AIResponse } from "./contracts";
import { liveAdapter } from "./liveAdapter";
import { mockAdapter } from "./mockAdapter";

// Mode switch: live (real AI, default) | mock (offline keywords) | scripted (fixed demo lines).
// Live falls back to the mock on error, >5s, or invalid JSON — gameplay never blocks.

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

// ---- diagnostics (dev only: ?debug=1 badge and /editor "Test AI") ----
export type AdapterUsed = "live" | "mock" | "scripted" | "mock-fallback" | "hardcoded-fallback";
export interface AIDiagnostics {
  mode: AIMode;
  adapterUsed: AdapterUsed;
  fallbackUsed: boolean;
  latencyMs: number;
  error?: string;
  /** e.g. "guest → false_hint" for The Guest's decisions */
  detail?: string;
}
let lastDiag: AIDiagnostics | null = null;
const listeners = new Set<(d: AIDiagnostics) => void>();
export const getLastAIDiagnostics = () => lastDiag;
export function onAIDiagnostics(fn: (d: AIDiagnostics) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** Lets other AI calls (The Guest) show up in the ?debug=1 badge. */
export function reportAIDiagnostics(diag: AIDiagnostics) {
  lastDiag = diag;
  listeners.forEach((l) => l(diag));
}

export async function interpretWithDiagnostics(
  request: AIRequest,
): Promise<{ response: AIResponse; diag: AIDiagnostics }> {
  const req = { ...request, answer: request.answer.slice(0, 60) };
  const mode = getAIMode();
  const t0 = performance.now();
  const finish = (response: AIResponse, adapterUsed: AdapterUsed, error?: string) => {
    const diag: AIDiagnostics = {
      mode,
      adapterUsed,
      fallbackUsed: response.fallbackUsed,
      latencyMs: Math.round(performance.now() - t0),
      ...(error ? { error } : {}),
    };
    lastDiag = diag;
    listeners.forEach((l) => l(diag));
    return { response, diag };
  };
  let error: string | undefined;
  try {
    return finish(await currentAdapter().interpretAnswer(req), mode);
  } catch (err) {
    error = (err as Error).message;
    console.warn("[ai] falling back to mock:", error);
  }
  try {
    return finish(
      { ...(await mockAdapter.interpretAnswer(req)), fallbackUsed: true },
      "mock-fallback",
      error,
    );
  } catch {
    // Last-resort deterministic fallback.
    return finish(
      request.questionType === "favorite_color"
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
          },
      "hardcoded-fallback",
      error,
    );
  }
}

export async function interpretAnswerSafe(request: AIRequest): Promise<AIResponse> {
  return (await interpretWithDiagnostics(request)).response;
}
