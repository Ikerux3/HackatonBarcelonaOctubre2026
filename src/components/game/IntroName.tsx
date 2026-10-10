import { useEffect, useRef, useState } from "react";

import { DEFAULT_NAME, sanitizeName } from "@/game/playerName";

interface Props {
  stage: "intro_name" | "intro_leave";
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
export function IntroName({ stage, name, onName, onDone }: Props) {
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
      className="g-title-room relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden px-6 py-6 text-center"
      onClick={() => stage === "intro_leave" && second.finished && onDone()}
    >
      <div className="g-grain" />
      <p className="font-display-sc relative text-sm tracking-[0.3em] text-[#f6dcae]">Mom</p>
      <p className="g-paper-card relative min-h-[5.5rem] max-w-xs px-5 py-4 font-display text-xl italic leading-relaxed text-[#3a2010]">
        “{first.shown}
        {stage === "intro_leave" ? second.shown : ""}
        <span className="animate-pulse">▍</span>”
      </p>

      {askName && (
        <form
          className="g-stage-in relative flex w-full max-w-xs flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onName(sanitizeName(value));
          }}
        >
          <label htmlFor="player-name" className="font-display text-xl italic text-[#fbeed2]">
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
            className="g-input g-input-paper min-h-12 w-full px-4 py-3 text-center"
          />
          <button
            type="submit"
            className="g-btn g-btn-warm px-6 py-3 text-lg"
          >
            That's me
          </button>
        </form>
      )}

      {stage === "intro_leave" && second.finished && (
        <p className="relative font-display text-base italic text-[#f6dcae]">…the front door closes.</p>
      )}
    </div>
  );
}
