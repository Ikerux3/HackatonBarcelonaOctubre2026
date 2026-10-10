import { useState } from "react";

import { ASSETS, type AssetId } from "@/game/levels/assets";

// Visual mapping only: book remains book in the pool, levels and game state.
const NORMAL_SPRITES: Partial<Record<AssetId, string>> = {
  ball: "ball",
  blocks: "blocks",
  doll: "doll",
  dino: "dino",
  teddy: "teddy",
  car: "car",
  robot: "robot",
  book: "rabbit", // provisional alias for Astra's sprite test
};

/** Decorative only; the parent tile owns all sizing, hitboxes and gestures. */
export function ToySprite({ asset, possessed = false }: { asset: AssetId; possessed?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const name = NORMAL_SPRITES[asset];
  const hasPossessedSprite = asset === "teddy" || asset === "car";
  const state = possessed && hasPossessedSprite ? "possessed" : "normal";
  const src = name ? `/assets/toys/${name}__${state}.webp` : null;

  if (!src || failedSrc === src) {
    return (
      <span className="pointer-events-none text-2xl leading-none" aria-hidden>
        {ASSETS[asset].emoji}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className="pointer-events-none block h-full w-full select-none object-contain"
      style={
        possessed && !hasPossessedSprite
          ? {
              filter: "grayscale(0.8) contrast(1.5) drop-shadow(0 0 4px #dc2626)",
            }
          : undefined
      }
      onError={() => setFailedSrc(src)}
    />
  );
}
