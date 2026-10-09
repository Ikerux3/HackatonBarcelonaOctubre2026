// Demo-safe AI mode switch. Never shown in the player UI.
export type AIMode = "live" | "mock" | "scripted";
export const AI_MODES: AIMode[] = ["live", "mock", "scripted"];

const MODE_KEY = "mwbb.ai.mode.v1";
const SCRIPT_KEY = "mwbb.editor.scripted.v1";

export interface ScriptedLines {
  favorite_color: string;
  favorite_toy: string;
}

export const DEFAULT_SCRIPTED: ScriptedLines = {
  favorite_color: "That color… I'll keep it safe for you. In the dark.",
  favorite_toy: "It's been waiting under your bed. It missed you.",
};

const isMode = (v: unknown): v is AIMode => AI_MODES.includes(v as AIMode);

/** URL ?ai= wins and is remembered; otherwise localStorage; default live. */
export function getAIMode(): AIMode {
  if (typeof window === "undefined") return "live";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ai");
    if (isMode(fromUrl)) {
      localStorage.setItem(MODE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = localStorage.getItem(MODE_KEY);
    return isMode(stored) ? stored : "live";
  } catch {
    return "live";
  }
}

export function setAIMode(mode: AIMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function getScriptedLines(): ScriptedLines {
  try {
    const raw = JSON.parse(
      localStorage.getItem(SCRIPT_KEY) ?? "null",
    ) as Partial<ScriptedLines> | null;
    return {
      favorite_color:
        typeof raw?.favorite_color === "string" && raw.favorite_color
          ? raw.favorite_color
          : DEFAULT_SCRIPTED.favorite_color,
      favorite_toy:
        typeof raw?.favorite_toy === "string" && raw.favorite_toy
          ? raw.favorite_toy
          : DEFAULT_SCRIPTED.favorite_toy,
    };
  } catch {
    return DEFAULT_SCRIPTED;
  }
}

export function setScriptedLines(lines: ScriptedLines): void {
  try {
    localStorage.setItem(SCRIPT_KEY, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
}
