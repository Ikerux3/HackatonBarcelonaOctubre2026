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
