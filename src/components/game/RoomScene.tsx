import type { NormalizedColor } from "@/ai/contracts";
import { TABLE_ITEMS, TOYS, effectiveColor } from "@/game/PuzzleData";

interface RoomSceneProps {
  dark: boolean;
  toysTidied: string[];
  tableSet: string[];
  favoriteColor?: NormalizedColor;
  onTidyToy: (id: string) => void;
  onPlaceItem: (id: string) => void;
}

function ShapeGlyph({ shape, fill }: { shape: string; fill: string }) {
  switch (shape) {
    case "circle":
      return <circle cx="30" cy="26" r="16" fill={fill} />;
    case "rect":
      return <rect x="16" y="12" width="28" height="28" rx="4" fill={fill} />;
    case "triangle":
      return <polygon points="30,8 48,42 12,42" fill={fill} />;
    case "diamond":
      return <polygon points="30,8 48,26 30,44 12,26" fill={fill} />;
    default:
      return <circle cx="30" cy="26" r="16" fill={fill} />;
  }
}

/**
 * The dollhouse living room. One fixed scene; the personalization engine
 * only re-skins supported elements (color_removed variant), never moves
 * or hides puzzle-critical objects.
 */
export function RoomScene({
  dark,
  toysTidied,
  tableSet,
  favoriteColor,
  onTidyToy,
  onPlaceItem,
}: RoomSceneProps) {
  const drained = effectiveColor(favoriteColor);
  const isDrained = (c: NormalizedColor) => dark && c === drained;

  return (
    <div
      className={`relative mx-auto w-full max-w-md select-none overflow-hidden rounded-2xl border transition-colors duration-1000 ${
        dark ? "game-room-dark border-neutral-800" : "game-room-cozy border-amber-200"
      }`}
      style={{ aspectRatio: "4 / 5" }}
    >
      {/* wall + floor */}
      <div className={`absolute inset-x-0 top-0 h-3/5 ${dark ? "bg-neutral-900" : "bg-amber-100"}`} />
      <div className={`absolute inset-x-0 bottom-0 h-2/5 ${dark ? "bg-neutral-950" : "bg-orange-200"}`} />

      {/* window — the light source that dies */}
      <div
        className={`absolute left-6 top-8 h-20 w-16 rounded-t-full border-4 transition-colors duration-1000 ${
          dark ? "border-neutral-700 bg-neutral-800" : "border-amber-300 bg-sky-200"
        }`}
      >
        {!dark && <div className="absolute inset-0 animate-pulse rounded-t-full bg-yellow-100/60" />}
      </div>

      {/* lamp */}
      <div className="absolute right-8 top-10 flex flex-col items-center">
        <div className={`h-10 w-1 ${dark ? "bg-neutral-700" : "bg-amber-400"}`} />
        <div
          className={`h-8 w-12 rounded-b-full transition-colors duration-700 ${
            dark ? "bg-neutral-700" : "bg-yellow-300"
          } ${!dark ? "game-lamp-glow" : ""}`}
        />
      </div>

      {/* table */}
      <div className={`absolute bottom-24 left-1/2 h-3 w-40 -translate-x-1/2 rounded ${dark ? "bg-neutral-800" : "bg-amber-700"}`} />
      <div className={`absolute bottom-16 left-1/2 h-8 w-32 -translate-x-1/2 ${dark ? "bg-neutral-800" : "bg-amber-700"} opacity-80`} style={{ clipPath: "polygon(10% 0, 90% 0, 100% 100%, 0 100%)" }} />

      {/* table items (task_two) */}
      {TABLE_ITEMS.map((item, i) => {
        const placed = tableSet.includes(item.id);
        const shadowed = isDrained(item.color);
        const left = 18 + i * 22;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`${placed ? "Placed" : "Place"} ${item.label}`}
            disabled={placed}
            onClick={() => onPlaceItem(item.id)}
            className={`absolute z-10 flex h-16 w-16 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
              placed
                ? "border-transparent"
                : "border-dashed border-neutral-500 bg-black/20 active:scale-95"
            } ${shadowed ? "game-shadow-item" : ""}`}
            style={{
              left: `${left}%`,
              bottom: placed ? "27%" : "6%",
            }}
          >
            <svg viewBox="0 0 60 52" className="h-12 w-12" aria-hidden>
              <ShapeGlyph
                shape={item.shape}
                fill={shadowed ? "#1a1a1a" : item.hex}
              />
              {shadowed && (
                <ShapeGlyph shape={item.shape} fill="none" />
              )}
            </svg>
            <span className={`absolute -bottom-4 text-[10px] font-medium ${dark ? "text-neutral-400" : "text-amber-900"}`}>
              {item.label}
            </span>
          </button>
        );
      })}

      {/* toy box */}
      <div
        className={`absolute bottom-6 right-4 flex h-16 w-20 items-end justify-center rounded-b-lg border-2 pb-1 text-[10px] font-semibold ${
          dark ? "border-neutral-700 bg-neutral-800 text-neutral-500" : "border-amber-600 bg-amber-500 text-amber-950"
        }`}
      >
        TOYS
      </div>

      {/* toys (task_one) */}
      {TOYS.map((toy, i) => {
        const tidied = toysTidied.includes(toy.id);
        return (
          <button
            key={toy.id}
            type="button"
            aria-label={`${tidied ? "Tidied" : "Tidy"} ${toy.label}`}
            disabled={tidied}
            onClick={() => onTidyToy(toy.id)}
            className={`absolute z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 transition-all duration-500 active:scale-90 ${
              tidied
                ? "translate-y-1 scale-75 opacity-40"
                : dark
                  ? "border-neutral-600 bg-neutral-800"
                  : "border-white/60 shadow-lg"
            }`}
            style={{
              left: `${8 + i * 20}%`,
              bottom: tidied ? "8%" : `${14 + (i % 2) * 10}%`,
              backgroundColor: tidied || dark ? undefined : toy.hex,
            }}
          >
            <span className={`text-lg ${tidied ? "" : "game-bob"}`} aria-hidden>
              {toy.id === "ball" ? "⚽" : toy.id === "blocks" ? "🧱" : toy.id === "dolly" ? "🪆" : "🦖"}
            </span>
            <span className={`text-[9px] font-semibold ${dark ? "text-neutral-400" : "text-white drop-shadow"}`}>
              {toy.label}
            </span>
          </button>
        );
      })}

      {/* the child */}
      <div className="absolute bottom-20 left-[42%] z-10 flex flex-col items-center" aria-hidden>
        <div className={`h-8 w-8 rounded-full ${dark ? "bg-neutral-300" : "bg-amber-200"}`} />
        <div className={`h-10 w-6 rounded-t-full ${dark ? "bg-neutral-400" : "bg-sky-400"}`} />
      </div>

      {/* darkness vignette */}
      {dark && <div className="game-vignette pointer-events-none absolute inset-0" />}
    </div>
  );
}
