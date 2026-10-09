import { useEffect, useMemo, useRef, useState } from "react";

import { sfx } from "@/game/audio";
import { ASSETS, COLOR_HEX, type AssetId } from "@/game/levels/assets";
import type { Point, SceneObject, TidyOptions } from "@/game/levels/types";
import type { MinigameProps } from "./types";
import { SceneBackdrop } from "./SceneBackdrop";

const HIT_MARGIN = 5;

/** Small deterministic PRNG so a fixed seed always gives the same toys. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickToys(pool: AssetId[], count: number, seed: number): AssetId[] {
  const rnd = mulberry32(seed);
  const a = [...new Set(pool)];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, count);
}

type Cover = { toyId: string; role: "cushion" | "drawer"; open: boolean };

interface Drag {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  moved: boolean;
}

/**
 * tidy_roles: put N toys in the box. The role of each toy depends on the ORDER:
 * step k's role (plain / cushion / drawer) applies to whichever toy is next.
 * For cushion/drawer, the remaining toy closest to that spot slips under/into it;
 * the player removes the cushion / opens the drawer, then drags it. Other toys are
 * locked meanwhile. No timers, no fail state.
 */
export function TidyRolesMinigame({ level, dark, onComplete }: MinigameProps) {
  const tidy = (level.type === "tidy_roles" ? level.tidy : null) as TidyOptions | null;
  const sceneRef = useRef<HTMLDivElement>(null);
  const box = level.targets.find((t) => t.shape === "box") ?? level.targets[0]!;

  // per-run seed unless the level fixes one
  const [seed] = useState(() => tidy?.seed ?? Math.floor(Math.random() * 2 ** 31));
  const sprites = useMemo(
    () => pickToys(tidy?.pool ?? [], level.objects.length, seed),
    [tidy?.pool, level.objects.length, seed],
  );
  const spriteOf = (o: SceneObject, i: number): AssetId => sprites[i] ?? o.asset;

  const [placed, setPlaced] = useState<string[]>([]);
  const [pos, setPos] = useState<Record<string, Point>>({});
  const [cover, setCover] = useState<Cover | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = level.objects.length;
  const step = tidy?.steps[placed.length];

  // start the role for the next toy
  useEffect(() => {
    if (!tidy || !step || placed.length >= total) return;
    if (step.role === "plain") {
      setCover(null);
      return;
    }
    const spot = step.role === "cushion" ? tidy.cushion : tidy.drawer;
    const remaining = level.objects.filter((o) => !placed.includes(o.id));
    const toy = [...remaining].sort(
      (a, b) =>
        Math.hypot((pos[a.id]?.x ?? a.x) - spot.x, (pos[a.id]?.y ?? a.y) - spot.y) -
        Math.hypot((pos[b.id]?.x ?? b.x) - spot.x, (pos[b.id]?.y ?? b.y) - spot.y),
    )[0];
    if (!toy) return;
    setSelected(null);
    setPos((p) => ({ ...p, [toy.id]: spot }));
    setCover({ toyId: toy.id, role: step.role, open: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed.length]);

  useEffect(() => {
    if (!done && total > 0 && placed.length >= total) {
      setDone(true);
      setCover(null);
      onComplete?.();
    }
  }, [placed.length, total, done, onComplete]);

  const locked = (id: string) =>
    done || placed.includes(id) || (!!cover && (cover.toyId !== id || !cover.open));

  const openCover = () => {
    if (!cover || cover.open) return;
    if (cover.role === "drawer") sfx.odd();
    else sfx.click();
    setCover({ ...cover, open: true });
  };

  const toPct = (cx: number, cy: number) => {
    const r = sceneRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 };
  };
  const inBox = (x: number, y: number) =>
    Math.abs(x - box.x) <= box.w / 2 + HIT_MARGIN && Math.abs(y - box.y) <= box.h / 2 + HIT_MARGIN;

  const place = (id: string) => {
    sfx.snap();
    setPlaced((p) => (p.includes(id) ? p : [...p, id]));
    setSelected(null);
    if (cover?.toyId === id) setCover(null);
  };
  const reject = (id: string, wrongSpot: boolean) => {
    if (wrongSpot) sfx.wrong();
    setShake(id);
    setTimeout(() => setShake(null), 450);
  };

  const posOf = (o: SceneObject) => {
    if (drag?.id === o.id) return { x: drag.x, y: drag.y };
    if (placed.includes(o.id)) return { x: box.x, y: box.y };
    return pos[o.id] ?? { x: o.x, y: o.y };
  };

  const onDown = (e: React.PointerEvent, o: SceneObject) => {
    if (locked(o.id)) {
      if (!placed.includes(o.id)) reject(o.id, false);
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPct(e.clientX, e.clientY);
    const cur = posOf(o);
    sfx.click();
    setDrag({
      id: o.id,
      x: cur.x,
      y: cur.y,
      dx: p.x - cur.x,
      dy: p.y - cur.y,
      sx: p.x,
      sy: p.y,
      moved: false,
    });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toPct(e.clientX, e.clientY);
    const moved = drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > 2;
    setDrag({ ...drag, x: p.x - drag.dx, y: p.y - drag.dy, moved });
  };
  const onUp = (o: SceneObject) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      setSelected((s) => (s === o.id ? null : o.id));
      return;
    }
    if (inBox(d.x, d.y)) place(o.id);
    else {
      // dropped elsewhere: toy stays where it was released (inside the scene)
      setPos((p) => ({
        ...p,
        [o.id]: { x: Math.min(95, Math.max(5, d.x)), y: Math.min(95, Math.max(30, d.y)) },
      }));
      reject(o.id, false);
    }
  };

  const coverSpot = cover ? (cover.role === "cushion" ? tidy!.cushion : tidy!.drawer) : null;

  return (
    <div
      ref={sceneRef}
      className={`relative w-full touch-none select-none overflow-hidden rounded-2xl border ${
        dark ? "game-room-dark border-neutral-800" : "game-room-cozy border-amber-200"
      }`}
      style={{ aspectRatio: "2 / 3" }}
    >
      <SceneBackdrop theme={level.theme} dark={dark} />

      {/* hint for the current step */}
      {!done && step?.hint && (
        <p className="pointer-events-none absolute inset-x-0 top-2 z-40 px-3 text-center font-serif text-sm italic text-amber-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
          {step.hint}
        </p>
      )}

      {/* static furniture: the drawer chest is always there */}
      {tidy && (
        <div
          className="pointer-events-none absolute z-0 rounded-md border-4 border-amber-900 bg-amber-700"
          style={{
            left: `${tidy.drawer.x - 14}%`,
            top: `${tidy.drawer.y - 9}%`,
            width: "28%",
            height: "18%",
          }}
          aria-hidden
        />
      )}

      {/* toy box */}
      <button
        type="button"
        aria-label={`Spot: ${box.label}`}
        onClick={() => {
          if (selected) {
            if (locked(selected)) return;
            place(selected);
          }
        }}
        className={`absolute z-10 flex items-end justify-center rounded-b-xl border-4 pb-1 transition-all duration-300 ${
          dark ? "border-neutral-600 bg-neutral-800" : "border-amber-700 bg-amber-500"
        } ${(drag || selected) && !done ? "game-box-open" : ""} ${selected ? "ring-2 ring-amber-200/70" : ""}`}
        style={{
          left: `${box.x - box.w / 2}%`,
          top: `${box.y - box.h / 2}%`,
          width: `${box.w}%`,
          height: `${box.h}%`,
        }}
      >
        <span
          className={`text-[10px] font-bold uppercase ${dark ? "text-neutral-400" : "text-amber-950"}`}
        >
          {box.label}
        </span>
        {/* lid closes when everything is put away */}
        <span
          className={`absolute -top-2 left-[-6%] h-3 w-[112%] origin-left rounded border-2 transition-transform duration-500 ${
            dark ? "border-neutral-500 bg-neutral-700" : "border-amber-800 bg-amber-600"
          }`}
          style={{ transform: done ? "rotate(0deg)" : "rotate(-35deg) translateY(-6px)" }}
          aria-hidden
        />
      </button>

      {/* toys */}
      {level.objects.map((o, i) => {
        const isPlaced = placed.includes(o.id);
        const dragging = drag?.id === o.id;
        const lockedNow = locked(o.id);
        const sprite = spriteOf(o, i);
        const { x, y } = posOf(o);
        return (
          <button
            key={o.id}
            type="button"
            aria-label={`${isPlaced ? "Placed" : "Move"} ${ASSETS[sprite].label}`}
            aria-pressed={selected === o.id}
            aria-disabled={lockedNow}
            onPointerDown={(e) => onDown(e, o)}
            onPointerMove={onMove}
            onPointerUp={() => onUp(o)}
            onPointerCancel={() => setDrag(null)}
            className={`absolute flex touch-none flex-col items-center justify-center rounded-2xl border-2 border-white/60 ${
              dragging ? "z-40 scale-110 shadow-2xl" : isPlaced ? "z-[5]" : "z-20 shadow-lg"
            } ${selected === o.id ? "ring-4 ring-amber-300" : ""} ${shake === o.id ? "game-shake" : ""} ${
              isPlaced ? "pointer-events-none" : ""
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${o.size}%`,
              aspectRatio: "1",
              transform: `translate(-50%, -50%) ${isPlaced ? "scale(0.2)" : ""}`,
              opacity: isPlaced ? 0 : lockedNow && !cover ? 1 : lockedNow ? 0.55 : 1,
              backgroundColor: COLOR_HEX[o.color],
              transition: dragging
                ? "none"
                : "left .45s ease, top .45s ease, transform .35s ease, opacity .45s ease",
            }}
          >
            <span className="pointer-events-none text-2xl leading-none" aria-hidden>
              {ASSETS[sprite].emoji}
            </span>
            <span className="pointer-events-none mt-0.5 text-[9px] font-bold text-white drop-shadow">
              {ASSETS[sprite].label}
            </span>
          </button>
        );
      })}

      {/* role cover: cushion (tap/drag away) or drawer front (tap to open) */}
      {cover && coverSpot && (
        <button
          type="button"
          aria-label={cover.role === "cushion" ? "Move the cushion" : "Open the drawer"}
          onPointerDown={openCover}
          className={`absolute z-30 flex min-h-12 items-center justify-center border-4 shadow-xl transition-all duration-500 ${
            cover.role === "cushion"
              ? "rounded-[40%] border-rose-900 bg-rose-400"
              : "rounded-md border-amber-950 bg-amber-800"
          } ${cover.open ? "pointer-events-none" : "game-wobble"}`}
          style={{
            left: `${coverSpot.x + (cover.open && cover.role === "cushion" ? 22 : 0)}%`,
            top: `${coverSpot.y + (cover.open && cover.role === "drawer" ? 14 : 0)}%`,
            width: "26%",
            height: "14%",
            transform: `translate(-50%, -50%) ${cover.open && cover.role === "cushion" ? "rotate(18deg)" : ""}`,
            opacity: cover.open && cover.role === "drawer" ? 0.85 : 1,
          }}
        >
          {cover.role === "drawer" && (
            <span className="h-2 w-6 rounded-full bg-amber-300" aria-hidden />
          )}
        </button>
      )}

      {/* progress, always visible */}
      <div className="pointer-events-none absolute bottom-1 right-2 z-40 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-neutral-100">
        {Math.min(placed.length, total)}/{total}
      </div>
    </div>
  );
}
