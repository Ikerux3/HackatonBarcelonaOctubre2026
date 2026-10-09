import { AI_MODES, DEFAULT_SCRIPTED, type AIMode, type ScriptedLines } from "@/ai/aiMode";
import { STORY_LEVELS } from "./levels/defaultLevels";
import type { LevelConfig } from "./levels/types";
import { validateLevel } from "./levels/validate";

// Demo profile: which level plays in each story slot (+ AI mode and scripted lines).
// Everything read from storage or files is untrusted and validated; any bad slot
// falls back to its built-in level so the player route can never break.

export const STORY_SLOTS = ["task_one", "task_two", "task_three"] as const;
export type StorySlot = (typeof STORY_SLOTS)[number];

export interface StorySlotEntry {
  /** editor entry key it was chosen from (builtin-N or draft key) — informational */
  source: string;
  /** snapshot of the level, so the profile is self-contained */
  level: LevelConfig;
}
export type StoryConfig = Record<StorySlot, StorySlotEntry>;
export type StoryLevels = Record<StorySlot, LevelConfig>;

export interface DemoProfile {
  kind: "mwbb-demo-profile";
  version: 1;
  story: StoryConfig;
  aiMode: AIMode;
  scriptedLines: ScriptedLines;
  drafts: { key: string; level: LevelConfig }[];
}

export const STORY_KEY = "mwbb.demo.story.v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObj = (v: unknown): v is any => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates a story object; returns usable levels + per-slot errors. */
export function validateStory(input: unknown): {
  levels: StoryLevels;
  story: StoryConfig | null;
  errors: string[];
} {
  const errors: string[] = [];
  const levels = { ...STORY_LEVELS } as StoryLevels;
  const story = {} as StoryConfig;
  if (!isObj(input)) return { levels, story: null, errors: ["story must be an object."] };
  for (const slot of STORY_SLOTS) {
    const e = input[slot];
    const v = validateLevel(isObj(e) ? e.level : undefined);
    if (v.ok) {
      levels[slot] = v.level;
      story[slot] = {
        source: isObj(e) && typeof e.source === "string" ? e.source : "",
        level: v.level,
      };
    } else {
      errors.push(`${slot}: ${v.errors.slice(0, 3).join(" ")}`);
    }
  }
  return { levels, story: errors.length ? null : story, errors };
}

/** Player route: saved story if valid (per slot), otherwise built-in. Never throws. */
export function loadStoryLevels(): StoryLevels {
  try {
    const raw = localStorage.getItem(STORY_KEY);
    if (!raw) return { ...STORY_LEVELS };
    return validateStory(JSON.parse(raw)).levels;
  } catch {
    return { ...STORY_LEVELS };
  }
}

export function loadStoryConfig(): StoryConfig | null {
  try {
    const raw = localStorage.getItem(STORY_KEY);
    return raw ? validateStory(JSON.parse(raw)).story : null;
  } catch {
    return null;
  }
}

export function saveStoryConfig(story: StoryConfig): void {
  try {
    localStorage.setItem(STORY_KEY, JSON.stringify(story));
  } catch {
    /* ignore */
  }
}

export function clearStoryConfig(): void {
  try {
    localStorage.removeItem(STORY_KEY);
  } catch {
    /* ignore */
  }
}

export type ProfileResult = { ok: true; profile: DemoProfile } | { ok: false; errors: string[] };

/** Validates an imported profile file. Rejects the whole file if anything is wrong. */
export function parseProfileJson(text: string): ProfileResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
  }
  if (!isObj(data) || data.kind !== "mwbb-demo-profile")
    return { ok: false, errors: ["Not a demo profile file."] };
  const errors: string[] = [];
  const s = validateStory(data.story);
  errors.push(...s.errors);
  const aiMode = AI_MODES.includes(data.aiMode as AIMode) ? (data.aiMode as AIMode) : null;
  if (!aiMode) errors.push(`aiMode must be one of: ${AI_MODES.join(", ")}.`);
  const sl = isObj(data.scriptedLines) ? data.scriptedLines : {};
  const line = (k: keyof ScriptedLines) =>
    typeof sl[k] === "string" && sl[k] ? (sl[k] as string).slice(0, 140) : DEFAULT_SCRIPTED[k];
  const drafts: DemoProfile["drafts"] = [];
  if (data.drafts !== undefined && !Array.isArray(data.drafts))
    errors.push("drafts must be a list.");
  (Array.isArray(data.drafts) ? data.drafts : []).forEach((d: unknown, i: number) => {
    const v = validateLevel(isObj(d) ? d.level : undefined);
    if (!v.ok) errors.push(`draft #${i + 1}: ${v.errors.slice(0, 2).join(" ")}`);
    else
      drafts.push({
        key: isObj(d) && typeof d.key === "string" ? d.key : `imp${i}`,
        level: v.level,
      });
  });
  if (errors.length || !s.story || !aiMode) return { ok: false, errors };
  return {
    ok: true,
    profile: {
      kind: "mwbb-demo-profile",
      version: 1,
      story: s.story,
      aiMode,
      scriptedLines: { favorite_color: line("favorite_color"), favorite_toy: line("favorite_toy") },
      drafts,
    },
  };
}
