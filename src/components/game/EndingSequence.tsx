import { useEffect, useState } from "react";

import type { GameMemory, GameStage } from "@/game/GameState";
import { ASSETS, COLORS, COLOR_HEX, TOY_ASSET } from "@/game/levels/assets";
import { SceneBackdrop } from "@/components/minigames/SceneBackdrop";

interface Props {
  stage: Extract<GameStage, "goodnight_whisper" | "mom_returns" | "unsettling_detail">;
  /** locally validated name (or "sweetie") — never the raw answer text */
  name: string;
  memory: GameMemory;
  /** cleaned labels only, used for screen-reader text */
  toyText: string;
  colorText: string;
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
export function EndingSequence({ stage, name, memory, toyText, colorText }: Props) {
  if (stage === "goodnight_whisper") return <Whisper name={name} />;
  if (stage === "mom_returns") return <MomHome name={name} />;
  return <Detail memory={memory} toyText={toyText} colorText={colorText} />;
}

function Whisper({ name }: { name: string }) {
  const line = useTyped(`Good night, ${name}.`, 140, 600);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-6 text-center">
      <p className="font-serif text-2xl italic tracking-wide text-neutral-400" aria-live="polite">
        {line}
      </p>
    </div>
  );
}

function MomHome({ name }: { name: string }) {
  return (
    <div className="game-room-cozy relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <SceneBackdrop theme="living_room" dark={false} />
      {/* front door swinging open */}
      <div
        aria-hidden
        className="absolute bottom-[30%] left-1/2 h-48 w-28 -translate-x-1/2 rounded-t-md bg-amber-950/80"
      >
        <div className="game-door-open absolute inset-0 origin-left rounded-t-md border-4 border-amber-900 bg-amber-700" />
      </div>
      <p className="game-monster-line relative z-10 mt-[-30vh] max-w-xs rounded-xl bg-amber-50/90 px-4 py-3 font-serif text-xl text-amber-950 shadow-lg">
        “I'm home, {name}! Did you tidy up?”
      </p>
    </div>
  );
}

function Detail({
  memory,
  toyText,
  colorText,
}: {
  memory: GameMemory;
  toyText: string;
  colorText: string;
}) {
  const toy = ASSETS[TOY_ASSET[memory.favoriteToy ?? "other"]];
  const stolen = memory.favoriteColor;
  return (
    <div
      className="game-room-cozy relative flex min-h-dvh items-end justify-center overflow-hidden"
      role="img"
      aria-label={`The room is cozy again, but ${toyText} sits on the dinner table, and ${colorText} is gone from the room.`}
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
    </div>
  );
}
