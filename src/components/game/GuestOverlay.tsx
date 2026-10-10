import { ArtImage, artAsset } from "@/components/minigames/ArtImage";
import { useEffect, useState } from "react";

import type { GuestDecision } from "@/ai/contracts";
import { sfx } from "@/game/audio";
import { useGuestVoice } from "./GuestVoice";

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
  useGuestVoice(decision.line, showLine);

  useEffect(() => {
    const timers = [setTimeout(() => setShowLine(true), 1200)];
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
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      {flicker && <div className="game-light-disturb absolute inset-0" />}
      {/* ink creeping in from the edges while The Guest is present */}
      <div className="g-corruption-edge g-stage-in" style={{ opacity: 0.55 }} />
      {passing && (
        <ArtImage
          src={artAsset("guest", "silhouette")}
          className="game-shadow-pass g-guest-body absolute bottom-[8%] h-[70%] object-contain"
        />
      )}
      {showLine && (
        <ArtImage
          src={artAsset("guest", "ink-corner")}
          className="absolute left-0 top-[45%] h-[30%] w-[10%] object-contain opacity-60"
        />
      )}
      {showLine && (
        <p
          className="g-guest-note g-guest-line game-monster-line absolute inset-x-3 bottom-12 px-4 py-2.5 text-center text-lg leading-snug"
          aria-live="polite"
        >
          “{decision.line}”
        </p>
      )}
    </div>
  );
}
