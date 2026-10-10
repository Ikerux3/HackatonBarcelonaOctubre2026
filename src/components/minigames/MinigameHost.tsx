import { useState, type ComponentType } from "react";

import { validateLevel } from "@/game/levels/validate";
import { observe } from "@/game/observer";
import type { MinigameType } from "@/game/levels/types";
import { DragMinigame } from "./DragMinigame";
import { FlashlightMinigame } from "./FlashlightMinigame";
import { MomRoomMinigame } from "./MomRoomMinigame";
import { MusicBoxMinigame } from "./MusicBoxMinigame";
import { TableForThreeMinigame } from "./TableForThreeMinigame";
import { TidyRolesMinigame } from "./TidyRolesMinigame";
import type { MinigameProps } from "./types";

/** Registry: minigame type → component. Add new types here. */
export const MINIGAME_REGISTRY: Record<MinigameType, ComponentType<MinigameProps>> = {
  drag_to_target: DragMinigame,
  place_items: DragMinigame,
  flashlight_find: FlashlightMinigame,
  tidy_roles: TidyRolesMinigame,
  table_for_three: TableForThreeMinigame,
  music_box: MusicBoxMinigame,
  mom_room: MomRoomMinigame,
};

interface HostProps extends MinigameProps {
  /** shown when a level is invalid so the player is never soft-locked */
  onSkip?: () => void;
}

/** Validates, picks the component from the registry, adds objective + restart. */
export function MinigameHost({
  level,
  memory,
  dark,
  onComplete,
  onSkip,
  onRememberFood,
}: HostProps) {
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
          <button
            type="button"
            onClick={onSkip}
            className="mt-3 rounded-lg bg-red-100 px-4 py-2 font-bold text-red-950"
          >
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
        <p className={`g-tag px-4 py-2 text-base leading-tight ${dark ? "g-tag-dark" : ""}`}>
          {check.level.instructions}
        </p>
        <button
          type="button"
          onClick={() => {
            observe.restart();
            setRound((r) => r + 1);
          }}
          aria-label="Restart this task"
          className={`g-btn g-tag min-w-12 shrink-0 px-3 text-sm ${dark ? "g-tag-dark" : ""}`}
        >
          ↺ Restart
        </button>
      </div>
      <Game
        key={`${check.level.id}-${round}`}
        level={check.level}
        memory={memory}
        dark={dark}
        {...(onComplete ? { onComplete } : {})}
        {...(onRememberFood ? { onRememberFood } : {})}
      />
    </div>
  );
}
