import { useState, type ComponentType } from "react";

import { validateLevel } from "@/game/levels/validate";
import type { MinigameType } from "@/game/levels/types";
import { DragMinigame } from "./DragMinigame";
import type { MinigameProps } from "./types";

/** Registry: minigame type → component. Add new types here. */
export const MINIGAME_REGISTRY: Record<MinigameType, ComponentType<MinigameProps>> = {
  drag_to_target: DragMinigame,
  place_items: DragMinigame,
};

interface HostProps extends MinigameProps {
  /** shown when a level is invalid so the player is never soft-locked */
  onSkip?: () => void;
}

/** Validates, picks the component from the registry, adds objective + restart. */
export function MinigameHost({ level, memory, dark, onComplete, onSkip }: HostProps) {
  const [round, setRound] = useState(0);
  const check = validateLevel(level);

  if (!check.ok) {
    return (
      <div className="w-full rounded-xl border border-red-800 bg-red-950/60 p-4 text-sm text-red-100">
        <p className="font-bold">This level is broken:</p>
        <ul className="mt-2 list-disc pl-5">
          {check.errors.slice(0, 6).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        {onSkip && (
          <button type="button" onClick={onSkip} className="mt-3 rounded-lg bg-red-100 px-4 py-2 font-bold text-red-950">
            Skip level
          </button>
        )}
      </div>
    );
  }

  const Game = MINIGAME_REGISTRY[check.level.type];
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-neutral-100">
          {check.level.instructions}
        </p>
        <button
          type="button"
          onClick={() => setRound((r) => r + 1)}
          aria-label="Restart this task"
          className="min-h-10 shrink-0 rounded-full bg-black/60 px-3 text-sm font-semibold text-neutral-100 active:scale-95"
        >
          ↺ Restart
        </button>
      </div>
      <Game key={`${check.level.id}-${round}`} level={check.level} memory={memory} dark={dark} {...(onComplete ? { onComplete } : {})} />
    </div>
  );
}
