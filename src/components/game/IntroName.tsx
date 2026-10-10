import { useEffect, useRef, useState } from "react";

import type { NormalizedColor } from "@/ai/contracts";
import { COLOR_HEX } from "@/game/levels/assets";
import { DEFAULT_NAME, sanitizeName } from "@/game/playerName";
import { MomFigure } from "./Figures";

interface Props {
  stage: "intro_name" | "intro_leave";
  /** mom's dress color for this run (provisional cue until the comic intro exists) */
  motherColor: NormalizedColor | undefined;
  name: string | null;
  onName: (name: string) => void;
  /** tap to skip the goodbye (the stage also advances on its own) */
  onDone: () => void;
}

const FIRST = "I'm going to get dinner, ";
const rest = (name: string) =>
  `${name}. I'll be back in a few minutes. Remember to tidy up your toys, okay?`;

/** Types `text` one character at a time. */
function useTypewriter(text: string, speed = 45) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return { shown: text.slice(0, n), finished: n >= text.length };
}

/** Mom's goodbye with a pause for the player's name. No monster, no blackout. */
export function IntroName({ stage, motherColor, name, onName, onDone }: Props) {
  const first = useTypewriter(FIRST);
  const second = useTypewriter(stage === "intro_leave" ? rest(name ?? DEFAULT_NAME) : "");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const askName = stage === "intro_name" && first.finished;

  useEffect(() => {
    if (askName) inputRef.current?.focus({ preventScroll: true });
  }, [askName]);

  return (
    <div
      className="game-room-cozy flex h-full flex-col items-center justify-center gap-4 px-6 py-6 text-center"
      onClick={() => stage === "intro_leave" && second.finished && onDone()}
    >
      {motherColor && <MomFigure color={COLOR_HEX[motherColor]} className="h-24" />}
      <p className="text-xs uppercase tracking-[0.3em] text-amber-900/70">Mom</p>
      <p className="min-h-[5.5rem] max-w-xs font-serif text-xl italic leading-relaxed text-amber-950">
        “{first.shown}
        {stage === "intro_leave" ? second.shown : ""}
        <span className="animate-pulse">▍</span>”
      </p>

      {askName && (
        <form
          className="flex w-full max-w-xs flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onName(sanitizeName(value));
          }}
        >
          <label htmlFor="player-name" className="font-serif text-lg text-amber-950">
            What's your name?
          </label>
          <input
            id="player-name"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={16}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Your name"
            className="min-h-12 w-full rounded-xl border-2 border-amber-800 bg-amber-50 px-4 py-3 text-center text-base text-amber-950 placeholder:text-amber-900/40 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-amber-900 px-6 py-3 text-base font-bold text-amber-50 active:scale-95"
          >
            That's me
          </button>
        </form>
      )}

      {stage === "intro_leave" && second.finished && (
        <p className="text-sm text-amber-900/70">…the front door closes.</p>
      )}
    </div>
  );
}
