interface EndingScreenProps {
  /** in-memory run duration, ms */
  lastedMs: number;
  /** cleaned labels only (displayAnswer or category) — never raw player text */
  colorText: string;
  toyText: string;
  /** what The Guest's model concluded about this player, one note per decision */
  noticed: string[];
  onReplay: () => void;
}

export function EndingScreen({ lastedMs, colorText, toyText, noticed, onReplay }: EndingScreenProps) {
  return (
    <div className="g-ending-room g-stage-in relative flex h-full flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-6 text-center">
      <div className="g-grain-dark" />
      <span className="g-smear left-[-10%] top-[12%] w-[60%]" aria-hidden />
      <h1 className="g-ink-text game-glitch relative text-4xl leading-tight">
        Mommy will be back
      </h1>
      <p className="g-guest-line relative -mt-3 text-base">
        The Guest remembers: {colorText} · {toyText}
      </p>
      {noticed.length > 0 && (
        <div className="g-guest-note relative max-w-xs px-5 py-4">
          <p className="font-display-sc text-xs tracking-[0.25em] text-[#a08a78]">
            What The Guest noticed about you
          </p>
          <ul className="g-guest-line mt-2 space-y-1.5 text-lg leading-snug">
            {noticed.map((n) => (
              <li key={n}>“{n}”</li>
            ))}
          </ul>
        </div>
      )}
      {lastedMs > 0 && (
        <p className="relative font-display text-xl italic text-[#d8c6b0]">
          You lasted{" "}
          <span className="font-display-sc not-italic text-[#f4e6c8]">
            {Math.floor(lastedMs / 60000)}:
            {String(Math.floor((lastedMs % 60000) / 1000)).padStart(2, "0")}
          </span>{" "}
          alone
        </p>
      )}
      <button type="button" onClick={onReplay} className="g-btn g-btn-ink relative mt-2 px-10 py-3 text-xl">
        Play again
      </button>
      <p className="relative -mt-2 font-display text-sm italic text-[#8a7a6a]">
        Play again and answer differently
      </p>
    </div>
  );
}
