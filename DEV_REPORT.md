# MOMMY WILL BE BACK — Development Report (MVP 1)

## Implemented features
- Full 8-stage state machine: `intro → task_one → blackout_one → question_one → task_two → blackout_two → question_two → ending` (explicit stages, no loose boolean flags).
- Task 1: tidy 4 toys (tap/click, mobile-friendly 64px targets).
- Blackout with flicker effect, monster silhouette (SVG, subtle sway/blink), and free-text question overlay.
- Task 2: set the dinner table. The player's normalized favorite color is drained from the matching object into a shadow silhouette (**color_removed** variant). Shape + label cues keep the puzzle solvable for every color — color is never the only indicator.
- Second question normalizes the favorite toy (**toy_shadow** variant) and the monster reuses it in dialogue.
- Ending references both earlier answers, suggests the mother's return, and offers Replay, which fully resets session memory.
- Mock AI adapter implementing the agreed contract (`AIRequest`/`AIResponse`), with simulated latency and a deterministic fallback so the game never blocks.
- Optional WebAudio effects (click, success, blackout, hum, door) — start only after the Play gesture.
- Mobile-first layout, reduced-motion support, no rapid flashing, Enter submits, input stays visible above the keyboard.

## Remaining limitations
- AI is a deterministic mock (keyword matching, EN/ES). No real AI integration exists yet.
- Toy silhouette assets are generic shapes; per-category silhouettes can be added to `PuzzleData` later.
- Audio is synthesized (no recorded ambience).
- Session state is in-memory only (reload restarts the game — always a valid state).

## Important files
- `src/game/GameState.ts` — stages, reducer, session memory
- `src/game/GameController.ts` — hook wiring stages, timers, audio, AI calls
- `src/game/PuzzleData.ts` — deterministic puzzle content
- `src/ai/contracts.ts` — shared AI contract (agreed with the AI dev)
- `src/ai/mockAdapter.ts` — mock implementation
- `src/ai/aiAdapter.ts` — **swap point** for the real service + safe fallback
- `src/components/game/` — GameScreen, RoomScene, MonsterOverlay, QuestionInput, EndingScreen
- `src/styles/game.css` — atmosphere, flicker/glitch animations, reduced-motion

## How to run
Standard Lovable preview; locally: `bun install && bun run dev`, open `/`.

## Replacing the mock with the real AI service
Implement `AIAdapter` (`interpretAnswer(request: AIRequest): Promise<AIResponse>`) against the real endpoint — server-side only, never expose keys in frontend code — and assign it in `src/ai/aiAdapter.ts` in place of `mockAdapter`. `interpretAnswerSafe` already wraps it with a deterministic fallback, so failures can never block gameplay.

## Dependencies added
None.

## Tests performed
Automated full playthrough in a mobile viewport (390×844, Playwright): Play → tidy all toys → blackout → answer "yellow" → monster line → table task with Plate drained to shadow → second blackout → answer "my teddy bear" → ending referencing both answers → Play again resets to intro. Zero console errors. Two real bugs found and fixed during testing (tidied toys blocking table taps; stale monster line on question two).

# Iteration 2
- Toy cleanup is now drag-to-box; dinner table is drag-to-spot with snapping. Pointer Events + pointer capture, `touch-action: none`, % coordinates, tap-object-then-tap-spot alternative, Restart button, wrong drops shake and return. No timers.
- Data-driven levels (`src/game/levels/`): typed `LevelConfig` union (`drag_to_target`, `place_items`), runtime validator, asset catalogue, registry host that shows a skippable error instead of crashing on bad levels.
- Monster interventions (`src/game/interventions.ts`): COLOR_THEFT (every normalized color maps to a visible stolen color), TOY_ECHO (also in the ending), PERSONAL_MEMORY whisper, LIGHT_DISTURBANCE, disturb_item wobble, FALSE_HINT. AI contract untouched; AI still the mock.
- `/editor` (dev only, not linked): levels list, templates, duplicate, delete w/ confirm, form editing, add/remove objects and zones, drag positioning, rules, simulated memory, playtest + restart, live validation, localStorage drafts, JSON export/import (text or file).
- Not done: switch_sequence minigame (optional), physical device testing.

# Iteration 3 — Real AI
- `src/ai/interpret.functions.ts`: server function (TanStack `createServerFn`) calling Lovable AI (`openai/gpt-6-astra`, Responses API, streamed, strict JSON schema). `LOVABLE_API_KEY` is read server-side only. Any language, vague answers mapped to the closest category, one English creepy line ≤20 words reusing the player's wording; offensive/nonsense → "other" + cold line.
- `src/ai/liveAdapter.ts`: calls it, 4 s timeout, zod-validates the `AIResponse`. `src/ai/aiAdapter.ts`: picks the adapter by mode and falls back to `mockAdapter` on any error/timeout/invalid data (`fallbackUsed: true`). `contracts.ts` unchanged.
- Answers capped at 60 chars (input + adapter + server). Hum/blackout keep playing while waiting.

## Switching AI modes
- `?ai=live` (default, real AI), `?ai=mock` (offline keywords), `?ai=scripted` (fixed lines, keyword categories so color theft still works). The URL choice is remembered in localStorage (`mwbb.ai.mode.v1`).
- Or use the "AI mode" selector at the top of `/editor`. Scripted lines are edited there too (`mwbb.editor.scripted.v1`). The player UI never shows the mode.

## Switching providers / models
- Change `model` in `interpret.functions.ts` (any Lovable AI Gateway model). To use another provider, implement `AIAdapter` in a new file (keep keys server-side in a server function) and return it from `currentAdapter()` in `aiAdapter.ts`.

## Iteration 4 — Bedtime flashlight + new ending

**Story flow (explicit `GameStage`s):**
`intro → task_one (tidy toys) → blackout_one → question_one (color) → task_two (set table, color stolen) → blackout_two → question_two (toy) → task_three (bedtime, flashlight) → blackout_three → knock → mother_voice → final_dark → ending`.
`TASK_DONE` replaces the old per-task actions; timed stages auto-advance via `TIMED_STAGES` in `GameController.ts` (`mother_voice` also continues on tap).

**New minigame `flashlight_find`** (`src/components/minigames/FlashlightMinigame.tsx`, registered in `MINIGAME_REGISTRY`):
- Room is dark; drag anywhere to move a radial light mask. Tap an object that was already lit to collect it. Success = all collected (`success.kind` "placed" means "collected"). No timers, no fail state.
- Level JSON: `targets: []`, objects use `targetId: ""`, plus `flashlight: { radius, evasive? }`.
  `evasive = { objectId, positions[1–8], whisper }` — the first time the light touches it, it moves to the hiding spot farthest from the light, the whisper shows, and the next time it can be collected.
- Personalization `favorite_toy` + `toy_shadow` replaces the evasive object's sprite with `TOY_ASSET[memory.favoriteToy]` (`evasiveAsset` in `interventions.ts`).
- Validated in `validate.ts` (radius 10–50, evasive object must exist, positions 0–100).

**New theme** `bedroom` (`SCENE_THEMES`, `SceneBackdrop`). **New assets:** pajamas, toothbrush, slippers.
**New built-in level** `bedtime` in `defaultLevels.ts` (`STORY_LEVELS.task_three`).

**Editor:** "+ Flashlight find" template; switching type to `flashlight_find` clears targets; Flashlight panel edits radius, evasive object, whisper and hiding spots (shown as numbered markers in the preview). Playtest uses the simulated toy.

**Ending:** knock → the mother's voice repeats the raw toy and color answers (things only the monster heard) → black screen → existing ending text, plus "Play again and answer differently" under the replay button (`MotherSequence.tsx`, `EndingScreen.tsx`).

## Iteration 5 — Demo profile (scripting the live demo)

All in `/editor` (still unlinked from the player flow). Logic: `src/game/demoProfile.ts`.

- **Story panel**: pick the level for `task_one`, `task_two`, `task_three` from built-ins (★) and drafts. Choosing anything makes the story "custom"; it is saved to `localStorage["mwbb.demo.story.v1"]` as `{ slot: { source, level } }` (level snapshots, re-synced when the draft is edited).
- **Demo profile file** (`Export profile` / `Import profile`): one JSON with `kind: "mwbb-demo-profile"`, `version: 1`, `story`, `aiMode`, `scriptedLines`, `drafts`. Import validates everything (every level via `validateLevel`) and rejects the whole file with a list of errors if anything is wrong.
- **Player route** (`GameScreen`): after hydration calls `loadStoryLevels()`; each slot uses the saved level only if it validates, otherwise the built-in one. Missing/corrupt storage = built-in story. Never throws.
- **Reset to built-in**: clears the story, restores default scripted lines and sets AI mode to `live`. Drafts are kept.
- **▶ Play full story**: saves the current story and opens `/?ai=<mode>` in a new tab.

Demo phone: open `/editor` on it → Import profile → ▶ Play full story (or just open `/`).
