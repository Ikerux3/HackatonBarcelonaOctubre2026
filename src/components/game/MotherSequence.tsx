import type { GameStage } from "@/game/GameState";

interface Props {
  stage: Extract<GameStage, "knock" | "mother_voice" | "final_dark">;
  rawColorAnswer: string | null;
  rawToyAnswer: string | null;
  onContinue: () => void;
}

/** Knock → the "mother" knows what only the monster was told → black. */
export function MotherSequence({ stage, rawColorAnswer, rawToyAnswer, onContinue }: Props) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black px-6 text-center">
      {stage === "knock" && (
        <p className="game-flicker font-serif text-2xl italic tracking-widest text-neutral-400">
          knock… knock… knock…
        </p>
      )}
      {stage === "mother_voice" && (
        <button
          type="button"
          onClick={onContinue}
          aria-label="Continue"
          className="flex max-w-sm flex-col items-center gap-4 text-center"
        >
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            from behind the door
          </span>
          <span className="game-monster-line font-serif text-xl italic leading-relaxed text-neutral-100">
            “Sweetie, it's mommy. Did you keep{" "}
            <span className="text-amber-200">{rawToyAnswer ?? "your toy"}</span> safe? I brought you
            something… <span className="text-amber-200">{rawColorAnswer ?? "your color"}</span>.”
          </span>
          <span className="mt-4 text-xs text-neutral-600">tap</span>
        </button>
      )}
      {stage === "final_dark" && <span className="sr-only">Darkness.</span>}
    </div>
  );
}
