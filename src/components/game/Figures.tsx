import { ArtImage } from "@/components/minigames/ArtImage";
import { COLOR_HEX } from "@/game/levels/assets";

// Astra figures with the original SVGs retained as load-failure fallbacks.

/** Mom: dark silhouette in a dress of this run's color. */
export function MomFigure({
  color,
  className = "",
  rescue = false,
}: {
  color: string;
  className?: string;
  rescue?: boolean;
}) {
  const colorName = Object.entries(COLOR_HEX).find(
    ([name, hex]) => hex === color && name !== "blue" && name !== "other",
  )?.[0];
  if (colorName)
    return (
      <span role="img" aria-label="Mom" className={`inline-block ${className}`}>
        <ArtImage
          src={`/assets/intro-ending/states/mother-${rescue ? "rescue" : "standing"}-${colorName}.webp`}
          className="h-full w-auto object-contain"
          fallback={<MomFallback color={color} />}
        />
      </span>
    );
  return <MomFallback color={color} className={className} />;
}
function MomFallback({ color, className = "h-full" }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 120" className={className} aria-label="Mom" role="img">
      <circle cx="30" cy="14" r="10" fill="#3b2a20" />
      <path d="M22 10c2-8 14-8 16 0 4 2 5 10 2 16H20c-3-6-2-14 2-16z" fill="#2a1d16" />
      <rect x="26" y="23" width="8" height="6" fill="#3b2a20" />
      <path d="M20 29h20l14 62H6z" fill={color} stroke="#2a1d16" strokeWidth="2" />
      <path d="M20 31l-7 30M40 31l7 30" stroke="#3b2a20" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 91v24M38 91v24" stroke="#3b2a20" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** The child: smaller, neutral pajamas. `crying`: tears running down (bad ending). */
export function ChildFigure({
  className = "",
  crying = false,
}: {
  className?: string;
  crying?: boolean;
}) {
  return (
    <span role="img" aria-label={crying ? "The child, crying" : "The child"} className={`inline-block ${className}`}>
      <ArtImage
        src={`/assets/intro-ending/sprites/child-${crying ? "crying" : "worried"}.webp`}
        className="h-full w-auto object-contain"
        fallback={<ChildFallback crying={crying} />}
      />
    </span>
  );
}
function ChildFallback({ crying }: { crying: boolean }) {
  const className = "h-full";
  return (
    <svg
      viewBox="0 0 40 80"
      className={className}
      aria-label={crying ? "The child, crying" : "The child"}
      role="img"
    >
      <circle cx="20" cy="12" r="9" fill="#3b2a20" />
      {crying && (
        <g fill="#7dd3fc" stroke="#0c4a6e" strokeWidth="0.4">
          <path d="M15 11c-1.6 3-2 5.5 0 6.6 2-1.1 1.6-3.6 0-6.6z" />
          <path d="M25 11c-1.6 3-2 5.5 0 6.6 2-1.1 1.6-3.6 0-6.6z" />
        </g>
      )}
      <path d="M11 22h18l3 30H8z" fill="#cbd5e1" stroke="#2a1d16" strokeWidth="2" />
      <path d="M11 24l-5 18M29 24l5 18" stroke="#3b2a20" strokeWidth="4" strokeLinecap="round" />
      <path d="M14 52v24M26 52v24" stroke="#3b2a20" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
