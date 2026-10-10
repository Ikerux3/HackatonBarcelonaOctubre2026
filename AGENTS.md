<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Minigame levels are plain JSON files, one per level, in `src/game/levels/data/` (story order in `data/story.json`), loaded by `defaultLevels.ts`, validated at runtime and rendered via `MINIGAME_REGISTRY` in `src/components/minigames/MinigameHost.tsx` — keeps level authoring code-free and lets the editor import untrusted files safely. Don't hardcode levels in TypeScript; `src/test/levels.test.ts` guards the files. Guide: `docs/05-COMO-EDITAR-NIVELES.md`.
- The game route runs inside `GameShell` (fixed box sized to the visible viewport): no page scroll, no `min-h-dvh`/bottom-padding tricks for the keyboard — use `h-full` and let the shell shrink.
- Monster personalization goes through the local mapping in `src/game/interventions.ts`; the shared AI contract (`src/ai/contracts.ts`) is not changed without the AI developer's agreement.
- `/editor` is a developer-only tool (localStorage drafts, no auth) and must never be linked from the player flow.
- Visual styling for the game lives in `src/styles/game-art.css` (`g-*` classes) plus `CorruptionLayer`; it is presentation-only and must never carry game state — keeps art iterations from breaking gameplay.
