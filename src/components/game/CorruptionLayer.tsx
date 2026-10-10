/**
 * Reusable corruption overlay for any scene (visual only). Level 0–3:
 * 0 clean · 1 edges darken + one stain · 2 more stains, drips, far eyes ·
 * 3 heavy edges, stains spread, eyes in the corners.
 * Positions are fixed so the same room decays the same way each run, and
 * everything stays at the edges so the play area remains readable.
 */
const STAINS = [
  { l: "-4%", t: "8%", w: "26%", h: "16%", lvl: 1 },
  { l: "82%", t: "60%", w: "24%", h: "14%", lvl: 2 },
  { l: "70%", t: "-3%", w: "30%", h: "14%", lvl: 2 },
  { l: "-6%", t: "78%", w: "30%", h: "18%", lvl: 3 },
  { l: "40%", t: "-5%", w: "22%", h: "10%", lvl: 3 },
];
const DRIPS = [
  { l: "12%", h: "18%", d: "0s", lvl: 2 },
  { l: "77%", h: "12%", d: "2.5s", lvl: 2 },
  { l: "52%", h: "9%", d: "4s", lvl: 3 },
  { l: "88%", h: "22%", d: "1s", lvl: 3 },
];

export function CorruptionLayer({ level }: { level: 0 | 1 | 2 | 3 }) {
  if (level === 0) return null;
  return (
    <div className="g-corruption z-[50]" aria-hidden>
      <div className="g-corruption-edge" style={{ opacity: [0, 0.45, 0.7, 1][level] }} />
      {STAINS.filter((s) => s.lvl <= level).map((s, i) => (
        <span
          key={i}
          className="g-stain"
          style={{ left: s.l, top: s.t, width: s.w, height: s.h, animationDelay: `${i * 1.3}s` }}
        />
      ))}
      {DRIPS.filter((d) => d.lvl <= level).map((d, i) => (
        <span key={i} className="g-drip" style={{ left: d.l, height: d.h, animationDelay: d.d }} />
      ))}
      {level >= 2 && (
        <svg className="absolute left-[4%] top-[30%] h-4 w-10" viewBox="0 0 40 14">
          <g className="g-eyes-far">
            <ellipse cx="10" cy="7" rx="3.2" ry="2" className="g-eye g-eye-red" />
            <ellipse cx="28" cy="7" rx="3.2" ry="2" className="g-eye g-eye-red" />
          </g>
        </svg>
      )}
      {level >= 3 && (
        <svg className="absolute right-[3%] top-[44%] h-4 w-10" viewBox="0 0 40 14">
          <g className="g-eyes-far" style={{ animationDelay: "3s" }}>
            <ellipse cx="10" cy="7" rx="3" ry="1.8" className="g-eye" />
            <ellipse cx="28" cy="7" rx="3" ry="1.8" className="g-eye" />
          </g>
        </svg>
      )}
    </div>
  );
}

/** SVG filters shared by the art layer (mounted once by GameShell). */
export function ArtFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="g-ink-wobble" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7">
          <animate attributeName="baseFrequency" dur="9s" values="0.03;0.045;0.03" repeatCount="indefinite" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" scale="9" />
      </filter>
    </svg>
  );
}
