import { useEffect, useState } from "react";

import type { GuestDecision } from "@/ai/contracts";
import { sfx } from "@/game/audio";

interface Props {
  decision: GuestDecision;
  shadow: boolean;
  flicker: boolean;
}

/**
 * The Guest's presence on top of a task: its whispered line (proof it was
 * watching), and optionally a silhouette crossing the room or a stuttering light.
 * Purely visual — never blocks input.
 */
export function GuestOverlay({ decision, shadow, flicker }: Props) {
  const [showLine, setShowLine] = useState(false);
  const [passing, setPassing] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShowLine(true), 1200),
      setTimeout(() => setShowLine(false), 7200),
    ];
    if (shadow)
      timers.push(
        setTimeout(() => {
          sfx.hum();
          setPassing(true);
        }, 3800),
        setTimeout(() => setPassing(false), 6600),
      );
    return () => timers.forEach(clearTimeout);
  }, [shadow]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden" aria-hidden>
      {flicker && <div className="game-light-disturb absolute inset-0" />}
      {/* ink creeping in from the edges while The Guest is present */}
      <div className="g-corruption-edge g-stage-in" style={{ opacity: 0.55 }} />
      {passing && (
        <svg
          className="game-shadow-pass g-guest-body absolute bottom-[8%] h-[70%]"
          viewBox="0 0 60 160"
          preserveAspectRatio="xMidYMax meet"
        >
          {/* tall, thin, slightly hunched figure */}
          <path
            d="M30 6c7 0 11 6 11 13 0 6-3 10-6 12 9 4 14 14 15 30l3 40c0 4-4 5-6 2l-4-28-2 60c0 6-8 6-8 0l-3-45-3 45c0 6-8 6-8 0l-2-60-4 28c-2 3-6 2-6-2l3-40c1-16 6-26 15-30-3-2-6-6-6-12 0-7 4-13 11-13z"
            fill="#050505"
            opacity="0.85"
          />
          <circle cx="26" cy="18" r="1.4" fill="#e04848" />
          <circle cx="34" cy="18" r="1.4" fill="#e04848" />
        </svg>
      )}
      {showLine && (
        <p className="g-guest-note g-guest-line game-monster-line absolute inset-x-3 bottom-12 px-4 py-2.5 text-center text-lg leading-snug">
          “{decision.line}”
        </p>
      )}
    </div>
  );
}
