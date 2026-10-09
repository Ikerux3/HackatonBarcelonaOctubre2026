import { useEffect } from "react";

import type { GameMemory } from "@/game/GameState";
import { sfx } from "@/game/audio";
import { ASSETS, TOY_ASSET } from "@/game/levels/assets";

interface EndingScreenProps {
  memory: GameMemory;
  rawColorAnswer: string | null;
  rawToyAnswer: string | null;
  onReplay: () => void;
}

export function EndingScreen({
  memory,
  rawColorAnswer,
  rawToyAnswer,
  onReplay,
}: EndingScreenProps) {
  useEffect(() => {
    const t = setTimeout(() => sfx.door(), 2500);
    return () => clearTimeout(t);
  }, []);

  const color = memory.favoriteColor ?? "other";
  const toy = rawToyAnswer ?? "your toy";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-center">
      <div className="game-glitch font-serif text-3xl font-bold text-neutral-100">
        MOMMY WILL BE BACK
      </div>

      <span className="game-echo text-7xl" role="img" aria-label="The shadow of your favorite toy">
        {ASSETS[TOY_ASSET[memory.favoriteToy ?? "other"]].emoji}
      </span>

      <p className="max-w-sm font-serif text-lg italic leading-relaxed text-neutral-300">
        “I know you love{" "}
        <span className={`game-reveal-color game-color-${color}`}>{rawColorAnswer ?? color}</span>.
        And I know about <span className="text-neutral-100">{toy}</span>. I'll keep them both… until
        next time.”
      </p>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-neutral-400">…a key turns in the front door.</p>
        <p className="font-serif text-xl text-neutral-100">“Sweetie? I'm home!”</p>
        <p className="max-w-xs text-sm text-neutral-500">
          The lights come back on. The toys are in their box. The table is set. Nothing is out of
          place. Nothing at all.
        </p>
      </div>

      <button
        type="button"
        onClick={onReplay}
        className="mt-4 min-h-12 rounded-xl bg-neutral-100 px-8 py-3 text-base font-bold text-neutral-950 active:scale-95"
      >
        Play again
      </button>
      <p className="-mt-3 text-xs italic text-neutral-500">Play again and answer differently</p>
    </div>
  );
}
