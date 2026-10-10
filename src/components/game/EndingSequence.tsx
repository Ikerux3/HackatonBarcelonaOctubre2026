import { useEffect, useState } from "react";

import type { GameMemory, GameStage } from "@/game/GameState";
import { ASSETS, COLORS, COLOR_HEX, TOY_ASSET } from "@/game/levels/assets";
import { SceneBackdrop } from "@/components/minigames/SceneBackdrop";

interface Props {
  stage: Extract<GameStage, "goodnight_whisper" | "mom_returns" | "unsettling_detail">;
  /** locally validated name (or "sweetie") — never the raw answer text */
  name: string;
  memory: GameMemory;
  /** cleaned labels only (displayAnswer or category) — never raw player text */
  toyText: string;
  colorText: string;
  /** tap on the final detail skips to the ending screen */
  onSkip: () => void;
}

function useTyped(text: string, msPerChar: number, delay = 0) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    let iv: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      iv = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length && iv) clearInterval(iv);
      }, msPerChar);
    }, delay);
    return () => {
      clearTimeout(start);
      if (iv) clearInterval(iv);
    };
  }, [text, msPerChar, delay]);
  return text.slice(0, n);
}

/** Final blackout whisper → mom really comes home → one detail is wrong. */
export function EndingSequence({ stage, name, memory, toyText, colorText, onSkip }: Props) {
  if (stage === "goodnight_whisper") return <Whisper name={name} />;
  if (stage === "mom_returns") return <MomHome name={name} />;
  return <Detail memory={memory} toyText={toyText} colorText={colorText} onSkip={onSkip} />;
}

function Whisper({ name }: { name: string }) {
  const line = useTyped(`Good night, ${name}.`, 140, 600);
  return (
    <div className="g-ink-veil relative flex h-full items-center justify-center overflow-hidden bg-black px-6 text-center">
      <div className="g-grain-dark" />
      <svg className="absolute left-1/2 top-[30%] h-5 w-16 -translate-x-1/2" viewBox="0 0 40 14" aria-hidden>
        <g className="g-eyes-far">
          <ellipse cx="12" cy="7" rx="3" ry="1.6" className="g-eye" />
          <ellipse cx="28" cy="7" rx="3" ry="1.6" className="g-eye" />
        </g>
      </svg>
      <p className="g-guest-line relative text-3xl" aria-live="polite">
        {line}
      </p>
    </div>
  );
}

function MomHome({ name }: { name: string }) {
  return (
    <div className="g-title-room g-stage-in relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <SceneBackdrop theme="living_room" dark={false} />
      {/* front door swinging open */}
      <div
        aria-hidden
        className="absolute bottom-[30%] left-1/2 h-48 w-28 -translate-x-1/2 rounded-t-md bg-amber-950/80"
      >
        <div className="game-door-open absolute inset-0 origin-left rounded-t-md border-4 border-amber-900 bg-amber-700" />
      </div>
      <p className="g-paper-card game-monster-line relative z-10 mt-[-30vh] max-w-xs px-5 py-3 font-display text-2xl italic text-[#3a2010]">
        “I'm home, {name}! Did you tidy up?”
      </p>
    </div>
  );
}

function Detail({
  memory,
  toyText,
  colorText,
  onSkip,
}: {
  memory: GameMemory;
  toyText: string;
  colorText: string;
  onSkip: () => void;
}) {
  const toy = ASSETS[TOY_ASSET[memory.favoriteToy ?? "other"]];
  const stolen = memory.favoriteColor;
  // fixed template, no AI call: instant, and only ever shows cleaned labels
  const goodbye = useTyped(
    `I'll keep ${toyText} safe for you. And ${colorText}… that's mine now.`,
    45,
    1500,
  );
  return (
    <button
      type="button"
      onClick={onSkip}
      className="g-title-room g-stage-in relative flex h-full w-full items-end justify-center overflow-hidden"
      aria-label={`The room is cozy again, but ${toyText} sits on the dinner table, and ${colorText} is gone from the room. Tap to continue.`}
    >
      <SceneBackdrop theme="dining_room" dark={false} />
      {/* bunting on the wall: the stolen color is missing */}
      <div className="absolute inset-x-4 top-[12%] flex justify-between" aria-hidden>
        {COLORS.filter((c) => c !== "other").map((c) => (
          <span
            key={c}
            className="h-8 w-6"
            style={{
              clipPath: "polygon(0 0,100% 0,50% 100%)",
              backgroundColor: c === stolen ? "transparent" : COLOR_HEX[c],
              outline: c === stolen ? "1px dashed rgba(0,0,0,.25)" : undefined,
            }}
          />
        ))}
      </div>
      {/* dinner table with the toy where it shouldn't be */}
      <div className="absolute bottom-[22%] left-1/2 w-[80%] max-w-sm -translate-x-1/2" aria-hidden>
        <div className="relative h-6 rounded-md border-4 border-amber-900 bg-amber-700">
          <span className="absolute -top-6 left-[18%] text-2xl">🍽️</span>
          <span className="game-echo absolute -top-12 left-1/2 -translate-x-1/2 text-5xl">
            {toy.emoji}
          </span>
          <span className="absolute -top-6 right-[18%] text-2xl">🍽️</span>
        </div>
        <div className="mx-auto flex w-[85%] justify-between">
          <span className="h-24 w-3 bg-amber-900" />
          <span className="h-24 w-3 bg-amber-900" />
        </div>
      </div>
      {/* The Guest's goodbye, built only from cleaned labels */}
      {goodbye && (
        <p
          aria-hidden
          className="g-guest-note g-guest-line game-monster-line absolute inset-x-4 bottom-[6%] mx-auto max-w-sm px-4 py-2.5 text-center text-lg"
        >
          {goodbye}
        </p>
      )}
    </button>
  );
}
