import type { LevelConfig } from "./types";
import { validateLevel } from "./validate";
import manifest from "./data/story.json";

// Levels are plain JSON files in ./data — one file per level, named after its id.
// Add a level: export it from /editor (or copy an existing file), drop it in ./data.
// Change what plays: edit ./data/story.json. No code changes needed; `bun run test`
// validates every file. A broken file never crashes the game: its slot shows a
// "This level is broken — Skip" card instead.

const files = import.meta.glob<{ default: unknown }>("./data/*.json", { eager: true });

const LEVELS = new Map<string, LevelConfig>();
/** file → validation errors, for tests and the console */
export const LEVEL_FILE_ERRORS: Record<string, string[]> = {};

for (const [path, mod] of Object.entries(files)) {
  if (path.endsWith("/story.json")) continue;
  const check = validateLevel(mod.default);
  if (!check.ok) {
    LEVEL_FILE_ERRORS[path] = check.errors;
    console.error(`[levels] ${path} is invalid:`, check.errors);
    continue;
  }
  if (LEVELS.has(check.level.id)) {
    LEVEL_FILE_ERRORS[path] = [`duplicate level id "${check.level.id}"`];
    console.error(`[levels] ${path}: duplicate level id "${check.level.id}"`);
    continue;
  }
  LEVELS.set(check.level.id, check.level);
}

/** Missing/invalid level: fails validation on purpose, so MinigameHost offers "Skip". */
function missing(id: string): LevelConfig {
  return { id, title: `Missing level "${id}"` } as unknown as LevelConfig;
}
export const levelById = (id: string): LevelConfig => LEVELS.get(id) ?? missing(id);

// Templates the editor and tests rely on (keep these files; copy them to make new levels).
export const TIDY_TOYS = levelById("tidy_toys");
export const SET_TABLE = levelById("set_table");
export const BEDTIME = levelById("bedtime");
export const TIDY_TOYS_DRAG = levelById("tidy_toys_drag");
export const MUSIC_BOX = levelById("music_box");
export const MOM_ROOM = levelById("mom_room");

/** Editor list: manifest order first (keeps saved "builtin-N" keys stable), then any new files. */
export const BUILT_IN_LEVELS: LevelConfig[] = [
  ...manifest.editorOrder.filter((id) => LEVELS.has(id)).map(levelById),
  ...[...LEVELS.keys()]
    .filter((id) => !manifest.editorOrder.includes(id))
    .sort()
    .map(levelById),
];

/** Which level plays at each task stage of the main story (./data/story.json). */
export const STORY_LEVELS = {
  task_one: levelById(manifest.story.task_one),
  task_two: levelById(manifest.story.task_two),
  task_music: levelById(manifest.story.task_music),
  task_mom: levelById(manifest.story.task_mom),
  task_three: levelById(manifest.story.task_three),
} as const;
