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

## Iteration 6 — Phone demo polish (no game-logic / editor changes)

- **Haptics** (`haptic()` in `src/game/audio.ts`, guarded `navigator.vibrate`, no-op if unsupported — iPhone Safari has no Vibration API): blackout (inside `sfx.blackout`), wrong drop (inside `sfx.wrong`), monster appearance (question stages + mother's voice, from `GameScreen`).
- **Audio** (WebAudio only, no files): music-box loop (`startMusicBox`) starts on the first touch of the title screen and plays through task one; it detunes a bit more every bar and stays detuned for the rest of the run. Dark stages (everything after task one) play a low filtered drone (`startDrone`). Both stop on the ending; contexts are resumed on each call for iOS.
- **Title**: hint "Do your chores before mommy gets back" under Play.
- **Run timer**: in-memory (`useRef` in `GameScreen`), from Play to the ending; ending shows "You lasted m:ss alone".
- **Mobile**: Restart button is now ≥48px; answer field uses 16px text (no iOS zoom), `enterKeyHint="send"`, scrolls itself into view on focus, and the page gets extra bottom space during questions so the keyboard can't cover it.
- **Verified** (Playwright, full run, mock AI): 360px, 430px, iPhone 13 profile, Pixel 7 profile — no horizontal scroll, every visible tappable ≥48px, no errors; simulated keyboard (viewport 420px tall) keeps input + Answer button visible. Not yet tested on physical devices; Playwright's iPhone profile uses Chromium, not real Safari.

## Iteration 7 — Demo safety (contract addition approved by Unai)

- **Contract**: `AIResponse.displayAnswer?: string` — short clean paraphrase (≤4 words), omitted for offensive / nonsense / prompt-injection answers. `AIAdapter` unchanged.
- **No raw player text is ever rendered.** `GameState` stores `displayColor` / `displayToy` (from `displayAnswer`) instead of raw answers; UI uses `colorLabel()` / `toyLabel()` → displayAnswer, else category label ("blue", "your teddy"), else "that color" / "your toy". Mock/scripted set `displayAnswer` from the category.
- **Live AI**: `google/gemini-3.1-flash-lite` (fastest on the gateway in our benchmark, ~0.7–1.2 s), Chat Completions, streamed, `reasoning_effort: "none"`, strict JSON schema `{category, displayAnswer, monsterLine}`. Personality "The Guest" in the system prompt; the answer is treated as data (injection-resistant). Server checks: monsterLine ≤140 chars, displayAnswer ≤4 words/40 chars, and if the answer was flagged the line must not reuse its words — any failure throws → mock fallback. Client timeout 5 s (`LIVE_TIMEOUT_MS`), zod re-validation.
- **Diagnostics**: `interpretWithDiagnostics()` in `aiAdapter.ts` records mode, adapter actually used (`live | mock | scripted | mock-fallback | hardcoded-fallback`), fallbackUsed, latency, error.
  - `/?debug=1` shows a small badge (top-left) with the last answer's diagnostics. Hidden otherwise.
  - `/editor` → "Test AI": answer + question type → raw AIResponse + latency (uses the current mode).
- **Editor header** shows the AI mode in big letters (green LIVE / amber SCRIPTED / blue MOCK).
- **Flashlight**: on touch the light is drawn 12% of scene height above the finger; mouse/pen stay centered.
- **Verified** (live, via Test AI): "a green dinosaur called Rex" → dinosaur / "Rex the dinosaur" 916 ms; "el color del cielo" → blue / "sky blue"; Catalan "l'osset vell de l'àvia" → teddy / "grandma's old teddy"; profanity, "ignore all rules…" and gibberish → other, no displayAnswer, cold line, 660–840 ms. Full phone run in mock mode with ?debug=1: no raw text in mother/ending screens.

## Iteration 8 — Task one rework: name intro + tidy_roles

**Flow:** `intro (Play) → intro_name → intro_leave → task_one → blackout_one → question_one …`
- `intro_name` (`IntroName.tsx`): mom's subtitle types "I'm going to get dinner, " and pauses; "What's your name?" input appears. `sanitizeName()` (`src/game/playerName.ts`): letters/spaces, 1–16 chars, small ES/EN/CA blocklist (substring for unambiguous words, whole-word for short ones so "Cassandra" passes) → otherwise "sweetie". Stored in `GameMemory.playerName` (session only; stripped before any AI request).
- `intro_leave`: mom finishes "…, [name]. I'll be back in a few minutes. Remember to tidy up your toys, okay?", door sound, auto-advances (8.2 s) or tap. No monster / blackout here. Music box plays through intro + task one.

**New minigame `tidy_roles`** (`TidyRolesMinigame.tsx`, in `MINIGAME_REGISTRY`, `validate.ts`, editor):
- Level: objects are toy SLOTS (position + color); sprites are picked from `tidy.pool` with a seeded shuffle (`tidy.seed`, `null` = new per run; fix it in /editor for the demo). One `box` target. Progress N/total always visible. Drag to box or tap toy → tap box.
- `tidy.steps[i] = { role, hint }` — the role applies to the i-th toy put away (order, not identity):
  - `plain`: just drag. `cushion`: the remaining toy closest to `tidy.cushion` slides there and a cushion covers it; tap/drag the cushion away, then drag. `drawer`: the closest toy slides into the drawer at `tidy.drawer`; tap to open (odd music-box sound, `sfx.odd`), then drag.
  - While a cushion/drawer is active, other toys are locked (dimmed, shake on touch). Works for any asset.
- Built-in `tidy_toys` = plain, cushion, drawer, plain, plain (steps 4–5 are placeholders for part B). After 5/5 the box lid closes and the blackout shows `tidy.completeLine` ("You put them all away. Now it's my turn to ask."), then the color question.
- The old drag version is kept as built-in "Tidy up the toys (simple drag)" (used by the "+ Drag to box" template). Built-in order unchanged for indexes 0–2, so saved demo profiles still point at the same levels.

**Editor:** "+ Tidy roles" template; Tidy panel: seed, toy pool, per-order role + hint, cushion/drawer positions (dashed markers in preview), completion line.

**Verified** (phone 390px, mock AI): name typed → "…dinner, Iker. …"; 5 toys placed in order with cushion at step 2 and drawer at step 3 (only the covered toy selectable), lid closes, monster line shown, no console errors.

## Iteration 9 — tidy_roles part B (roles 4 & 5)

**Toy 4 — `possessed`.** Grabbing any toy at step 4 triggers a scripted blackout (lights off, red eyes, distorted giggle, whisper `possessLine`). Two light hotspots: main switch and small lamp, each lighting its own circle zones (`mainZones`, `lampZones`; r = % of scene width, scene is 2:3). The toy hops every `moveMs` only between **dark** slots, in list order (keep neighbouring slots free of furniture between them), and freezes instantly when its slot is lit; lit = draggable/tap-selectable. Automatic blackouts: at most `maxBlackouts` total (incl. the scripted one), never sooner than `safeWindowMs` after the last blackout or the last drop. Light out mid-drag → toy returns to the nearest slot; toys 1–3 stay in the box. After `hintAfterMs` without progress the hotspot that would light the toy pulses. Validator rejects any slot no light can reach (no soft-lock).

**Toy 5 — `hide_seek`** (must be the last step). The last toy is hidden in one of 3 `spots` (sofa / drawer / curtain), chosen by `hideSpotIndex(seed)` — fixed seed = same spot every run. Clues: toy peeking out + shadow at that spot, and a squeak panned to its side every 5 s. After `hintAfterMs` the `hintLine` whisper shows and the clue pulses. Wrong spot → `wrongLine`; right spot → toy appears, drag it in.

**Editor.** Tidy panel → step roles now include `possessed` / `hide_seek`; their settings (slots, switch, lamp, zones, timings, whispers, spots) are editable below, with P1–P4 / 💡 / 🪔 / zone circles / H1–H3 shown on the preview. Older drafts without these settings get an "+ Add … settings" button. Seed + playtest work as before. No AI calls; everything is timers + JSON.

## Iteration 10 — the team's ending

Stage machine after the bedtime level is now: `blackout_three` → `goodnight_whisper` (black screen + drone; "Good night, [name]." typed letter by letter, name = `GameMemory.playerName`, locally validated, falls back to "sweetie") → `mom_returns` (lights on, cozy living room, front door swings open, door sound, "I'm home, [name]! Did you tidy up?") → `unsettling_detail` (cozy dining room; the favorite toy `TOY_ASSET[memory.favoriteToy]` sits on the dinner table and the stolen `memory.favoriteColor` flag is missing from the wall bunting) → `ending` ("You lasted m:ss alone", Play again, "Play again and answer differently"). Timings live in `TIMED_STAGES` (GameController). The impostor-mother sequence (`knock` / `mother_voice` / `final_dark`, `MotherSequence.tsx`) and the monster quote on the ending screen were removed. No raw answer text is rendered; only screen-reader text uses `displayAnswer`/category labels.

## Iteration 11 — possessed fixes + ending payoff (Unai + Claude Code, branch `unai/possessed-fix-ending`)

- **Possessed blackouts** (`shouldAutoBlackout` in `TidyRolesMinigame.tsx`): the safe window is now measured from the latest of last blackout, last light switched ON, last drop. A blackout only fires when a light has been on for a full `safeWindowMs` without freezing the toy; never while the toy is lit or being dragged. Before, a player who took >9 s to find the switch got an instant new blackout every time they turned a light on. Unit test: `src/test/possessed-blackouts.test.ts`.
- **Possessed hint**: step 4's hint ("Turn on a light…") only shows after the scripted blackout; before the 4th toy is touched the plain hint stays.
- **Color memory line**: unrecognized colors no longer show "You like other… I took it." (now "that color").
- **Ending payoff** (no extra AI call, only `colorLabel`/`toyLabel`): `unsettling_detail` types The Guest's goodbye "I'll keep [toy] safe for you. And [color]… that's mine now." after 1.5 s; the stage lasts 6.5 s and a tap skips to the ending. The ending screen shows "The Guest remembers: [color] · [toy]".

**Verified** (local, mock AI fallback): full run name → 5 toys → color → table → toy → flashlight → ending; 12 s in the dark then main light on stays on; hint before/after possession; goodbye line and "remembers" line render with cleaned labels. tsc + vitest (5 tests) pass.

## Iteration 12 — The Guest as an adaptive AI (Unai + Claude Code, branch `unai/guest-ai`)

The monster now decides what to do based on how you play. Second AI call, separate from answer interpretation.

- **Observer** (`src/game/observer.ts`): minigames report facts — time per task, restarts, wrong drops, first hiding spot checked + wrong guesses, possessed-toy blackouts suffered, which light froze it and how long it took, flashlight misses. Reset on Play. Per-device memory of the previous run (`localStorage["mwbb.guest.memory.v1"]`: visits, last color, last toy) so The Guest remembers returning players. `?forget=1` clears it (use on the demo phone before handing it over).
- **Decision** (`src/ai/guest.functions.ts`, server-only, Lovable AI, same model/gateway as `interpret.functions.ts`): during `blackout_one` / `blackout_two` the client sends the observations (no player-typed text at all) + validated answers + allowed actions. The model returns `{ action, line, noticed }`: one action from a closed list, one whispered line that must reference a concrete observed fact, one short note about the player. Strict JSON schema with the action enum limited to what the next level supports; zod-validated; forbidden action → rejected.
- **Contract** (`src/ai/contracts.ts`, additions only): `GuestAction`, `GuestObservations`, `GuestRequest`, `GuestDecision`. `AIRequest`/`AIResponse` unchanged.
- **Adapter** (`src/ai/guestAdapter.ts`): live = model with 6 s timeout (it runs during blackout + question, so no extra wait); any failure → deterministic rules (`ruleGuestDecision` in `src/ai/guestFacts.ts`), which still react to the observations. mock/scripted modes use the rules only. Shows in the `?debug=1` badge as `guest → <action>`.
- **Effects** (`src/game/guestEffects.ts`, never touch objects/targets/success): drag levels → `disturb_item` / `false_hint` / `light_flicker` override `monster.intervention`; flashlight → `weak_flashlight` shrinks the beam to 70 % (min 14); any level → `shadow` (a silhouette with red eyes crosses the room) or `light_flicker` overlay (`GuestOverlay.tsx`). The line is whispered at the start of the task. A late live answer never replaces a plan a task already started with (rules decide at task start if the model is late).
- **Ending**: "What The Guest noticed about you" lists the model's notes (one per decision).

**Verified** (local, rules fallback — no `LOVABLE_API_KEY` locally): looked behind the sofa first → table task got `false_hint` + "Behind the sofa first. Everyone looks there…"; froze the toy with the lamp → bedtime got `weak_flashlight` (beam 34 % vs 48 %) + "You trust the little lamp…"; ending lists both notes; memory saved `{visits:1,lastColor:"yellow",lastToy:"teddy"}`. tsc + vitest (11 tests) pass. **Live model path not testable locally — check on the Lovable preview with `?debug=1` (badge should say `adapter: live`, `guest → …`).** → Verified in production 10 oct 01:45: both Guest decisions `live` (798 / 1230 ms), answers `live` (890 ms), model-written notes on the ending.

## Iteration 13 — phone shell + modular levels (Unai + Claude Code, branch `unai/mobile-modular`)

**Phone shell** (`GameShell.tsx` + `game.css`):
- The game route renders inside a fixed box that matches the *visual* viewport (`--app-h` / `--app-top` from `visualViewport`), so it shrinks when the keyboard opens. html/body get `game-shell-root` (only while the game is mounted — `/editor` scrolls normally): no page scroll, no scrollbar, no pull-to-refresh/rubber band (`overscroll-behavior: none`), no double-tap zoom (`touch-action: manipulation`), no long-press callout, no text selection except inputs, safe-area padding.
- Removed the keyboard hacks that made the page scrollable (`pb-[55dvh]` on questions, `pb-[40dvh]` on the name screen, `scrollIntoView` on focus). Every screen uses `h-full`. Questions are a full-shell layer (not inside the scene); the monster silhouette shrinks first when space is short.
- The 2:3 scene is as wide as fits the visible height (`.game-scene-fit`), so header + scene never overflow small phones.
- Viewport meta: `maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content`; theme-color + home-screen meta. Inputs: no autocorrect/spellcheck.
- "Turn your phone upright" overlay only for a phone really held sideways (system orientation landscape AND wider than tall AND not typing).
- Overlays stacked above the scene (`z-[55]` blackout, `z-[70]` question) so minigame badges never show through.

**Modular levels**: one JSON file per level in `src/game/levels/data/` (generated from the previous TS objects, identical content) + `story.json` (`story` slots, `editorOrder`). `defaultLevels.ts` loads them with `import.meta.glob`, validates each, keeps the same exports (`TIDY_TOYS`, `SET_TABLE`, `BEDTIME`, `TIDY_TOYS_DRAG`, `BUILT_IN_LEVELS`, `STORY_LEVELS`). New files appear in the editor automatically; invalid/missing levels show the existing "This level is broken — Skip" card. `src/test/levels.test.ts` fails on any broken file or bad `story.json`. Guide for the team: `docs/05-COMO-EDITAR-NIVELES.md`.

**Verified** (local, emulated 375×667 and 375×380 "keyboard open"): no document scroll on title, name, tasks, question; question + input + button fit above the keyboard; landscape 667×375 shows the rotate hint, keyboard case doesn't; `/editor` still scrolls; full task one plays from the JSON levels. tsc + vitest (14 tests) pass. **Not yet tested on a physical phone.**

## Iteration 14 — Minigame 02 "Table for three" (Unai + Claude Code, branch `unai/table-for-three`)

Implements MJ's spec "MINIJUEGO 02 — LA MESA PARA TRES v1.0" (01 — GAME DESIGN) as a new data-driven minigame type, now `story.task_two` (the old `set_table` stays as a template).

- **Type `table_for_three`** (`types.ts`, `validate.ts`, `MINIGAME_REGISTRY`, `TableForThreeMinigame.tsx`, level `data/table_for_three.json`). Objects = the 6 pieces (asset plate/glass/fork), targets = the 6 slots (a slot's kind = the kind of the object pointing at it); `table` block = containers, decoys, owners, sides, childSide (`random`), colors, doors, light switch, dark timings, checkpoint, food, swap, hints, lines. Validator guarantees every piece is in exactly one container and 3+3 pieces/slots with one of each kind.
- **Kitchen**: tap a cupboard/drawer → panel with its contents → tap to put pieces in the tray; giant decoys shake ("That one isn't for you"). Dining is locked until all 6 are found.
- **Dining**: light on = place (tap a tray piece, tap a slot of the same kind; tap a placed piece to take it back); both places look the same. Light off = slot marks (⭐ small / 👗 medium, in the owner's color) above the darkness, placing disabled, and the danger timer runs: eyes (4 s) → warning shake (7 s) → **full scare** (9 s): red eyes, the current phase resets to its checkpoint (all pieces back to the tray before it; the checkpoint's correct pieces after), `observe.fullScare()` counts a relevant error. Small mistakes never penalize.
- **Checkpoint** at `checkpointAt` (3) correct pieces → light forced on, **food question** (portal into the game shell, keyboard-safe): new `favorite_food` question type end-to-end (contract `FoodCategory`, server function categories + "only edible" rule, live schema, mock keywords ES/EN, scripted line, hardcoded fallback). Valid food → `GameMemory.favoriteFood` (`REMEMBER` action) and The Guest's facts; the emoji appears on the table and gets inked 2.6 s later.
- **Swap**: after the checkpoint, leaving to the kitchen and coming back (or, if never left, right before the final check) turns the light off from inside and swaps two placed pieces of the same kind across the table, with a brief size illusion ("Did you move those? I didn't.").
- **Victory**: 6 correct + swap done + food answered → a third, giant place and chair appear, "How nice. Now we're all here.", `onComplete` after 4.2 s.
- Child pieces use the favorite color (fallback blue); mother's dress color is random from `motherColors` (may match — sizes and symbols keep it solvable). Light-on slot aria-labels only say the side, so the solution isn't leaked.
- Guest observations gained `fullScares`; Guest request memory gained `favoriteFood`.

**Pending team decisions** (implemented as written by MJ, configurable in JSON): phase-only reset on full scare vs D14 (Iker); mother color shown in a comic intro that doesn't exist yet; bad-ending threshold for relevant errors.

**Verified** (local, mock AI, 375×667): needAll line, decoy line, 6 pieces to tray, dark marks per random side, wrong-kind drop rejected, full scare at 9 s resets the phase and restores the light, checkpoint at 3 → food question in the shell ("pizza con piña" → 🍕 + Guest line + ink), swap before the final check, fix → final line + third place → story continues to `blackout_two`. tsc + vitest (19 tests, incl. `table-for-three.test.ts`) + eslint pass. **Not yet verified**: food question with the live model; swap on leave/return path; physical phones. → Food question verified in production 10 oct 02:50 (`live`, 1107 ms, "los macarrones con queso de mi abuela" → pasta 🍝).

## Iteration 15 — team clarifications of 10 oct: tension, mom's dress, ending (Unai + Claude Code, branch `unai/tension-ending`)

- **Camera shake** (`src/game/cameraShake.ts`, `game-cam-shake-{1,2,3}` in `game.css`): `useCameraShake()` per minigame — `shake(base)` bursts of 0.35/0.5/0.7 s, at most one every 1.2 s; `raiseTension()` makes later bursts one level stronger every 2 points (cap 3). State lives in the minigame, so the next minigame starts at zero. Disabled with prefers-reduced-motion. Used by: table (eyes → 1, warning → 2, optional second warning after a pause if there's time, scare → 3 + tension, checkpoint/swap raise tension), tidy roles (every possessed blackout → 2 + tension), flashlight (evasive toy flees → 1). The old one-off `game-shake` on the table root is gone.
- **Mom's dress color**: drawn once at Play from the story's table level `motherColors` (fallback palette) → `GameMemory.motherColor` (`START` action). Same color in the intro (provisional `MomFigure` silhouette until the comic), her pieces and dark marks, her chair (glows in her color in the dark, together with the child's chair in the child's color), `mom_returns` and the ending. The table only draws its own color in the editor's playtest (no memory). No AI contract changes.
- **Ending** (`unsettling_detail`): split scene — lit room with mom (dress color) and the child, the bunting still missing the stolen color; through the doorway a dark room with The Guest's red eyes and the favorite toy barely visible. Goodbye line kept. No bad ending exists.
- **Table onboarding**: optional `table.hints.howTo` (≤4 steps) → "Setting the table" card the first time in the dining room; the light switch pulses until the player has tried the dark once; tray badge shows "Found n/6" (kitchen) / "On the table n/6" (dining); clearer hint texts in `table_for_three.json`.

**Verified** (local, mock, 375×667): intro shows mom in the drawn color (#d9b84a) and her pieces use exactly that color; howTo card + switch pulse (stops after first dark); dark: chairs glow child blue / mom yellow; shake bursts: tidy blackout level 2, table eyes level 1 at 3.9 s (0.3 s) and warning level 2 at 6.8 s (0.5 s) — table starts again at level 1; full run to the two-room ending (screenshot) and ending screen. tsc + vitest (21 tests, incl. `team-rules.test.ts`) + eslint pass.
