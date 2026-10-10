import { useEffect, useRef, useState } from "react";
import { sfx } from "@/game/audio";
import type { CorduraEnding } from "@/game/cordura";
import type { GameMemory, GameStage } from "@/game/GameState";
import { ASSETS, COLORS, COLOR_HEX, TOY_ASSET } from "@/game/levels/assets";
import { SceneBackdrop } from "@/components/minigames/SceneBackdrop";
import { ChildFigure, MomFigure } from "./Figures";
import { useGuestVoice } from "./GuestVoice";
import type { GuestVoiceRole } from "@/game/guestVoice";

interface Props {
  stage: Extract<GameStage, "goodnight_whisper" | "mom_returns" | "unsettling_detail">;
  /** locally validated name (or "sweetie") — never the raw answer text */
  name: string;
  memory: GameMemory;
  /** cleaned labels only (displayAnswer or category) — never raw player text */
  toyText: string;
  colorText: string;
  /** from the Cordura frozen when the last minigame ended (D34); mom comes home in both */
  ending: CorduraEnding;
  finalValue: number;
  /** tap on the final detail skips to the ending screen */
  onSkip: () => void;
}

/** Final blackout whisper → mom really comes home → one detail is wrong. */
export function EndingSequence({ stage, name, memory, toyText, colorText, ending, finalValue, onSkip }: Props) {
  const momColor = COLOR_HEX[memory.motherColor ?? "pink"];
  if (stage === "goodnight_whisper")
    return <Whisper name={name} intense={finalValue >= 100} onDone={onSkip} />;
  if (stage === "mom_returns")
    return <MomHome name={name} momColor={momColor} ending={ending} onDone={onSkip} />;
  return (
    <Detail
      memory={memory}
      momColor={momColor}
      toyText={toyText}
      colorText={colorText}
      ending={ending}
      onSkip={onSkip}
    />
  );
}

function useSpokenStageAdvance(
  line: string,
  onDone: () => void,
  options: {
    delayMs: number;
    minimumMs: number;
    maxWaitMs: number;
    role?: GuestVoiceRole;
  },
) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [voiceFinished, setVoiceFinished] = useState(false);
  const advanced = useRef(false);
  useGuestVoice(line, true, options.delayMs, () => setVoiceFinished(true), options.role);

  useEffect(() => {
    advanced.current = false;
    setMinimumElapsed(false);
    setVoiceFinished(false);
    const minimumTimer = window.setTimeout(() => setMinimumElapsed(true), options.minimumMs);
    const safetyTimer = window.setTimeout(() => {
      if (advanced.current) return;
      advanced.current = true;
      onDone();
    }, options.maxWaitMs);
    return () => {
      window.clearTimeout(minimumTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [line, onDone, options.maxWaitMs, options.minimumMs]);

  useEffect(() => {
    if (!minimumElapsed || !voiceFinished || advanced.current) return;
    advanced.current = true;
    onDone();
  }, [minimumElapsed, onDone, voiceFinished]);
}

function Whisper({ name, intense, onDone }: { name: string; intense: boolean; onDone: () => void }) {
  const line = `Good night, ${name}.`;
  useSpokenStageAdvance(line, onDone, {
    delayMs: 600,
    minimumMs: 2800,
    maxWaitMs: 10_000,
  });
  useEffect(() => { if (intense) sfx.possessed(); }, [intense]);
  return (
    <div className="g-ink-veil relative flex h-full items-center justify-center overflow-hidden bg-black px-6 text-center">
      <div className="g-grain-dark" />
      {intense && <svg
        className="absolute left-1/2 top-[30%] h-5 w-16 -translate-x-1/2 motion-safe:animate-pulse"
        viewBox="0 0 40 14"
        aria-hidden
      >
        <g className="g-eyes-far">
          <ellipse cx="12" cy="7" rx="3" ry="1.6" className="g-eye" />
          <ellipse cx="28" cy="7" rx="3" ry="1.6" className="g-eye" />
        </g>
      </svg>}
      <p className={`g-guest-line relative text-3xl ${intense ? "text-red-400 motion-safe:animate-pulse" : ""}`} aria-live="polite">
        {line}
      </p>
    </div>
  );
}

function MomHome({
  name,
  momColor,
  ending,
  onDone,
}: {
  name: string;
  momColor: string;
  ending: CorduraEnding;
  onDone: () => void;
}) {
  const line =
    ending === "crying"
      ? `${name}? Oh, sweetie, you're crying… I'm here now. I'm here.`
      : `I'm home, ${name}! Did you tidy up?`;
  useEffect(() => sfx.door(), []);
  useSpokenStageAdvance(line, onDone, {
    delayMs: 250,
    minimumMs: 4000,
    maxWaitMs: 12_000,
    role: "mom",
  });
  return (
    <div className="g-title-room g-stage-in relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <SceneBackdrop theme="living_room" dark={false} />
      {/* front door swinging open — mom stands in it, in the same dress as at the start */}
      <div
        aria-hidden
        className="absolute bottom-[30%] left-1/2 flex h-48 w-28 -translate-x-1/2 items-end justify-center rounded-t-md bg-amber-950/80"
      >
        <MomFigure color={momColor} className="h-40" />
        <div className="game-door-open absolute inset-0 origin-left rounded-t-md border-4 border-amber-900 bg-amber-700" />
      </div>
      <p className="g-paper-card game-monster-line relative z-10 mt-[-30vh] max-w-xs px-5 py-3 font-display text-2xl italic text-[#3a2010]">
        “{line}”
      </p>
    </div>
  );
}

/**
 * Team's ending (10 oct): mom really is back, with the child in a lit room; through
 * the doorway, another room stays dark — The Guest is still there, with your toy.
 * D34: with Cordura 65+ the child is crying and very scared; below, a little scared.
 */
function Detail({
  memory,
  momColor,
  toyText,
  colorText,
  ending,
  onSkip,
}: {
  memory: GameMemory;
  momColor: string;
  toyText: string;
  colorText: string;
  ending: CorduraEnding;
  onSkip: () => void;
}) {
  const crying = ending === "crying";
  const toy = ASSETS[TOY_ASSET[memory.favoriteToy ?? "other"]];
  const stolen = memory.favoriteColor;
  // fixed template, no AI call: instant, and only ever shows cleaned labels
  const goodbye = `${crying ? "Shh… don't cry. " : ""}I'll keep ${toyText} safe for you. And ${colorText}… that's mine now.`;
  useSpokenStageAdvance(goodbye, onSkip, {
    delayMs: 1200,
    minimumMs: 6500,
    maxWaitMs: 15_000,
  });
  return (
    <button
      type="button"
      onClick={onSkip}
      className="g-stage-in relative flex h-full w-full overflow-hidden bg-black"
      aria-label={`${crying ? "Mom holds you while you cry, safe in a warm, lit room." : "Mom and you are safe in a warm, lit room."} In the dark room next door, something still holds ${toyText}. Tap to continue.`}
    >
      {/* the lit room: mom and the child, together */}
      <div className="g-title-room relative h-full w-[62%] overflow-hidden" aria-hidden>
        <div className="g-grain" />
        <div className="absolute left-1/2 top-[4%] flex -translate-x-1/2 flex-col items-center">
          <div className="h-6 w-0.5 bg-amber-500" />
          <div className="game-lamp-glow h-6 w-14 rounded-t-full bg-yellow-300" />
        </div>
        {/* bunting: the color it took is still missing */}
        <div className="absolute inset-x-3 top-[16%] flex justify-between">
          {COLORS.filter((c) => c !== "other").map((c) => (
            <span
              key={c}
              className="h-6 w-4"
              style={{
                clipPath: "polygon(0 0,100% 0,50% 100%)",
                backgroundColor: c === stolen ? "transparent" : COLOR_HEX[c],
                outline: c === stolen ? "1px dashed rgba(0,0,0,.25)" : undefined,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[34%] bg-orange-200" />
        <div className="absolute bottom-[20%] left-1/2 flex -translate-x-1/2 items-end gap-1">
          <MomFigure color={momColor} className="h-44" />
          <ChildFigure className="h-24" crying={crying} />
        </div>
      </div>
      {/* the wall, with an open doorway */}
      <div className="h-full w-[3%] bg-amber-950" aria-hidden />
      {/* the other room stays dark: The Guest is still there */}
      <div className="relative h-full flex-1 bg-black" aria-hidden>
        <div className="absolute inset-x-[12%] bottom-[20%] top-[22%] rounded-t-lg border-2 border-neutral-900" />
        <div className="game-eyes absolute left-1/2 top-[36%] flex -translate-x-1/2 gap-2">
          <span className="h-2 w-3 rounded-full bg-red-500 shadow-[0_0_8px_var(--color-red-500)]" />
          <span className="h-2 w-3 rounded-full bg-red-500 shadow-[0_0_8px_var(--color-red-500)]" />
        </div>
        {/* your toy, barely visible in its hands */}
        <span className="absolute bottom-[24%] left-1/2 -translate-x-1/2 text-4xl opacity-40 grayscale drop-shadow-[0_0_6px_rgba(255,60,60,0.35)]">
          {toy.emoji}
        </span>
      </div>
      {/* The Guest's goodbye, built only from cleaned labels */}
      <p
        aria-live="polite"
        className="g-guest-note g-guest-line game-monster-line absolute inset-x-4 bottom-[6%] mx-auto max-w-sm px-4 py-2.5 text-center text-lg"
      >
        {goodbye}
      </p>
    </button>
  );
}
