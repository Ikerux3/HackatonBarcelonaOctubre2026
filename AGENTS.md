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

- Minigame levels are plain JSON (`src/game/levels/`), validated at runtime and rendered via `MINIGAME_REGISTRY` in `src/components/minigames/MinigameHost.tsx` — keeps level authoring code-free and lets the editor import untrusted files safely.
- Monster personalization goes through the local mapping in `src/game/interventions.ts`; the shared AI contract (`src/ai/contracts.ts`) is not changed without the AI developer's agreement.
- `/editor` is a developer-only tool (localStorage drafts, no auth) and must never be linked from the player flow.
