import { useState, type CSSProperties, type ReactNode } from "react";
import manifest from "@/game/astra-art.json";

export type ArtScene = keyof typeof manifest;
export function artAsset(scene: ArtScene, asset: string) {
  const assets = manifest[scene].assets as Record<string, string>;
  return assets[asset] ? `/assets/${scene}/${assets[asset]}` : undefined;
}
export function ArtImage({
  src,
  className = "",
  style,
  fallback = null,
}: {
  src?: string | undefined;
  className?: string;
  style?: CSSProperties | undefined;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState<string | undefined>();
  const [loaded, setLoaded] = useState<string | undefined>();
  if (!src || failed === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={`g-art-image ${className}`}
      style={style}
      data-loaded={loaded === src || undefined}
      onLoad={() => setLoaded(src)}
      onError={() => setFailed(src)}
    />
  );
}
export function ArtBackground({ scene }: { scene: ArtScene }) {
  const path = manifest[scene].background;
  return path ? (
    <ArtImage
      src={`/assets/${scene}/${path}`}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : null;
}
/** Manifest decorations only; runtime objects and interactive anchors are rendered by their owners. */
export function ArtDecor({ scene, final = false }: { scene: ArtScene; final?: boolean }) {
  return (
    <>
      {manifest[scene].layers
        .filter((layer) => {
          const l = layer as typeof layer & { anchor?: string; previewHidden?: boolean };
          return !l.anchor || (l.anchor === "final.thirdChair" && final);
        })
        .map((l, i) => (
          <ArtImage
            key={i}
            src={artAsset(scene, l.asset)}
            className="absolute -translate-x-1/2 -translate-y-1/2 object-contain"
            style={{
              left: `${l.x}%`,
              top: `${l.y}%`,
              width: `${l.w}%`,
              height: `${l.h}%`,
              zIndex: l.z,
            }}
          />
        ))}
    </>
  );
}
