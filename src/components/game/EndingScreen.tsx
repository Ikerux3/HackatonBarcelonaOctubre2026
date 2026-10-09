interface EndingScreenProps {
  /** in-memory run duration, ms */
  lastedMs: number;
  /** cleaned labels only (displayAnswer or category) — never raw player text */
  colorText: string;
  toyText: string;
  onReplay: () => void;
}

export function EndingScreen({ lastedMs, colorText, toyText, onReplay }: EndingScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-center">
      <div className="game-glitch font-serif text-3xl font-bold text-neutral-100">
        MOMMY WILL BE BACK
      </div>
      <p className="-mt-3 font-serif text-sm italic text-red-300/80">
        The Guest remembers: {colorText} · {toyText}
      </p>
      {lastedMs > 0 && (
        <p className="font-serif text-lg text-neutral-300">
          You lasted{" "}
          <span className="font-bold text-neutral-100">
            {Math.floor(lastedMs / 60000)}:
            {String(Math.floor((lastedMs % 60000) / 1000)).padStart(2, "0")}
          </span>{" "}
          alone
        </p>
      )}
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
