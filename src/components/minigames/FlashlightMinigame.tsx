import { useEffect, useMemo, useRef, useState } from "react";

import { sfx } from "@/game/audio";
import { resolveInterventions } from "@/game/interventions";
import { observe } from "@/game/observer";
import { ASSETS, COLOR_HEX } from "@/game/levels/assets";
import type { Point, SceneObject } from "@/game/levels/types";
import type { MinigameProps } from "./types";
import { SceneBackdrop } from "./SceneBackdrop";

/** scene is 2:3, so 1% of height = 1.5% of width */
const ASPECT = 1.5;
const TAP_SLOP = 3; // % of width
/** an object counts as lit when its center is inside this fraction of the radius */
const LIT_FACTOR = 0.85;
/** on touch, the light sits this far above the finger (% of scene height) so it stays visible */
const TOUCH_OFFSET_Y = 12;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, (a.y - b.y) * ASPECT);

/**
 * flashlight_find: the room is dark; drag anywhere to move the light,
 * tap an object that is already lit to collect it. No timers, no fail state.
 * An optional evasive object flees once (first time it is lit), then can be collected.
 */
export function FlashlightMinigame({ level, memory, onComplete }: MinigameProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const opts = level.type === "flashlight_find" ? level.flashlight : { radius: 24 };
  const evasive = opts.evasive;
  const radius = opts.radius;
  const iv = useMemo(() => resolveInterventions(level, memory, true), [level, memory]);

  const [light, setLight] = useState<Point>({ x: 50, y: 62 });
  const [collected, setCollected] = useState<string[]>([]);
  const [moved, setMoved] = useState<Record<string, Point>>({});
  const [fled, setFled] = useState(false);
  const [whisper, setWhisper] = useState<string | null>(null);
  const [miss, setMiss] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const down = useRef<{ light: Point; at: Point; id: number } | null>(null);

  const required =
    level.success.kind === "all_placed"
      ? level.objects.length
      : Math.min(level.success.count, level.objects.length);

  const posOf = (o: SceneObject): Point => moved[o.id] ?? { x: o.x, y: o.y };
  const assetOf = (o: SceneObject) =>
    evasive && o.id === evasive.objectId && iv.evasiveAsset ? iv.evasiveAsset : o.asset;
  const isLit = (o: SceneObject, l: Point) => dist(posOf(o), l) <= radius * LIT_FACTOR;

  useEffect(() => {
    if (!done && required > 0 && collected.length >= required) {
      setDone(true);
      onComplete?.();
    }
  }, [collected.length, required, done, onComplete]);

  // evasive: first time the light touches it, it moves away and the monster whispers
  useEffect(() => {
    if (!evasive || fled || done) return;
    const o = level.objects.find((x) => x.id === evasive.objectId);
    if (!o || collected.includes(o.id) || !isLit(o, light)) return;
    const t = setTimeout(() => {
      const spot = [...evasive.positions].sort((a, b) => dist(b, light) - dist(a, light))[0];
      setFled(true);
      if (spot) setMoved((m) => ({ ...m, [o.id]: spot }));
      sfx.hum();
      setWhisper(evasive.whisper || null);
      setTimeout(() => setWhisper(null), 3200);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light, fled, done, evasive, collected]);

  const toPct = (e: React.PointerEvent): Point => {
    const r = sceneRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  };
  /** where the light is drawn: above the finger on touch, centered for mouse/pen */
  const lightAt = (e: React.PointerEvent, p: Point): Point =>
    e.pointerType === "touch" ? { x: p.x, y: Math.max(0, p.y - TOUCH_OFFSET_Y) } : p;

  const onDown = (e: React.PointerEvent) => {
    if (done) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPct(e);
    down.current = { light, at: p, id: e.pointerId };
    setLight(lightAt(e, p));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!down.current || down.current.id !== e.pointerId) return;
    setLight(lightAt(e, toPct(e)));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || done) return;
    const p = toPct(e);
    if (dist(p, d.at) > TAP_SLOP) return; // it was a drag
    // tap: collect the object under the finger if it was lit before the tap
    const hit = level.objects.find(
      (o) => !collected.includes(o.id) && dist(posOf(o), p) <= o.size / 2 + 4,
    );
    if (!hit) return;
    const litBefore = isLit(hit, d.light);
    const isEvasive = evasive?.objectId === hit.id;
    if (!litBefore || (isEvasive && !fled)) {
      if (!litBefore) observe.flashlightMiss();
      setMiss(hit.id);
      setTimeout(() => setMiss(null), 450);
      return;
    }
    sfx.snap();
    setCollected((c) => [...c, hit.id]);
  };

  // light radius as an ellipse in % so it stays circular on a 2:3 scene
  const rx = radius;
  const ry = radius / ASPECT;
  const mask = `radial-gradient(ellipse ${rx}% ${ry}% at ${light.x}% ${light.y}%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.97) 100%)`;

  return (
    <div
      ref={sceneRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => (down.current = null)}
      className="game-room-dark relative w-full cursor-none touch-none select-none overflow-hidden rounded-2xl border border-neutral-800"
      style={{ aspectRatio: "2 / 3" }}
      role="application"
      aria-label="Dark bedroom. Drag to move the flashlight, tap lit objects to collect them."
    >
      <SceneBackdrop theme={level.theme} dark={false} />

      {level.objects.map((o) => {
        const got = collected.includes(o.id);
        const { x, y } = posOf(o);
        return (
          <div
            key={o.id}
            aria-label={got ? `Found ${o.label}` : o.label}
            className={`pointer-events-none absolute z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-white/50 ${miss === o.id ? "game-shake" : ""}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${o.size}%`,
              aspectRatio: "1",
              transform: `translate(-50%, -50%) ${got ? "scale(0.2)" : ""}`,
              opacity: got ? 0 : 1,
              backgroundColor: COLOR_HEX[o.color],
              transition: "left .5s ease, top .5s ease, transform .4s ease, opacity .4s ease",
            }}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {ASSETS[assetOf(o)].emoji}
            </span>
            <span className="mt-0.5 text-[9px] font-bold text-white drop-shadow">{o.label}</span>
          </div>
        );
      })}

      {/* darkness with a hole where the flashlight points */}
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{ background: mask }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute z-20 rounded-full border border-amber-100/20"
        style={{
          left: `${light.x}%`,
          top: `${light.y}%`,
          width: `${rx * 2}%`,
          aspectRatio: "1",
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden
      />

      {whisper && (
        <p className="game-monster-line pointer-events-none absolute inset-x-0 top-3 z-30 px-4 text-center font-serif text-sm italic text-neutral-200">
          “{whisper}”
        </p>
      )}

      <div className="pointer-events-none absolute bottom-1 right-2 z-30 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-neutral-100">
        {level.objects.map((o) => (
          <span key={o.id} className={collected.includes(o.id) ? "" : "opacity-25 grayscale"}>
            {ASSETS[assetOf(o)].emoji}
          </span>
        ))}
        <span className="ml-1">
          {Math.min(collected.length, required)}/{required}
        </span>
      </div>
    </div>
  );
}
