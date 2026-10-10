import { useEffect, useMemo, useRef, useState } from "react";

import { sfx } from "@/game/audio";
import { useCorduraLight } from "@/game/cordura";
import { resolveInterventions } from "@/game/interventions";
import { observe } from "@/game/observer";
import { ASSETS, COLOR_HEX } from "@/game/levels/assets";
import type { SceneObject, TargetZone } from "@/game/levels/types";
import type { MinigameProps } from "./types";
import { SceneBackdrop } from "./SceneBackdrop";

interface DragState {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  moved: boolean;
}

const HIT_MARGIN = 5; // % — forgiving drop zones for fingers

/**
 * Shared engine for drag_to_target and place_items.
 * Pointer Events + pointer capture (works for mouse, touch and pen);
 * positions are % of the scene so scaling never breaks hit tests.
 * Tap an object, then tap a spot = accessible alternative to dragging.
 */
export function DragMinigame({ level, memory, dark, onComplete }: MinigameProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [wobble, setWobble] = useState<string | null>(null);
  const [falseHint, setFalseHint] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useCorduraLight(done ? null : dark ? "dark" : "lit");
  const fired = useRef(false);

  const iv = useMemo(() => resolveInterventions(level, memory, dark), [level, memory, dark]);
  const isPlace = level.type === "place_items";
  const required =
    level.success.kind === "all_placed"
      ? level.objects.length
      : Math.min(level.success.count, level.objects.length);

  // completion
  useEffect(() => {
    if (!done && required > 0 && placed.length >= required) {
      setDone(true);
      setSelected(null);
      onComplete?.();
    }
  }, [placed.length, required, done, onComplete]);

  // monster intervention — fires once, never undoes progress
  useEffect(() => {
    if (fired.current || done) return;
    const reached = iv.afterHalf ? placed.length >= Math.ceil(required / 2) : true;
    if (!reached) return;
    if (iv.disturbItem && placed.length > 0) {
      fired.current = true;
      const victim = placed[placed.length - 1]!;
      const t = setTimeout(() => {
        sfx.hum();
        setWobble(victim);
        setTimeout(() => setWobble(null), 1400);
      }, 500);
      return () => clearTimeout(t);
    }
    if (iv.falseHint) {
      fired.current = true;
      const filled =
        level.targets.find(
          (t) => !level.objects.some((o) => o.targetId === t.id && !placed.includes(o.id)),
        ) ?? level.targets[level.targets.length - 1];
      if (filled) {
        setFalseHint(filled.id);
        const t = setTimeout(() => setFalseHint(null), 1800);
        return () => clearTimeout(t);
      }
    }
    return undefined;
  }, [placed, required, iv, done, level]);

  const toPct = (clientX: number, clientY: number) => {
    const r = sceneRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };

  const hitTarget = (x: number, y: number): TargetZone | undefined =>
    level.targets.find(
      (t) => Math.abs(x - t.x) <= t.w / 2 + HIT_MARGIN && Math.abs(y - t.y) <= t.h / 2 + HIT_MARGIN,
    );

  const attempt = (obj: SceneObject, target: TargetZone | undefined) => {
    if (target && target.id === obj.targetId) {
      sfx.snap();
      setPlaced((p) => (p.includes(obj.id) ? p : [...p, obj.id]));
      setPop(target.id);
      setTimeout(() => setPop(null), 400);
    } else {
      if (target) {
        sfx.wrong();
        observe.wrongDrop();
      }
      setShake(obj.id);
      setTimeout(() => setShake(null), 450);
    }
    setSelected(null);
  };

  const onDown = (e: React.PointerEvent, obj: SceneObject) => {
    if (done || placed.includes(obj.id)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPct(e.clientX, e.clientY);
    sfx.click();
    setDrag({
      id: obj.id,
      x: obj.x,
      y: obj.y,
      dx: p.x - obj.x,
      dy: p.y - obj.y,
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
  const onUp = (obj: SceneObject) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      setSelected((s) => (s === obj.id ? null : obj.id));
      return;
    }
    attempt(obj, hitTarget(d.x, d.y));
  };

  const posOf = (o: SceneObject) => {
    if (drag?.id === o.id) return { x: drag.x, y: drag.y };
    if (placed.includes(o.id)) {
      const t = level.targets.find((t) => t.id === o.targetId);
      if (t) return { x: t.x, y: t.y };
    }
    return { x: o.x, y: o.y };
  };

  return (
    <div
      ref={sceneRef}
      className={`g-stage relative w-full touch-none select-none overflow-hidden rounded-2xl border ${
        dark ? "border-neutral-800 game-room-dark" : "border-amber-200 game-room-cozy"
      }`}
      style={{ aspectRatio: "2 / 3" }}
    >
      <SceneBackdrop theme={level.theme} dark={dark} />

      {iv.memoryLine && (
        <p className="game-monster-line pointer-events-none absolute inset-x-0 top-2 z-30 text-center font-serif text-sm italic text-neutral-300">
          “{iv.memoryLine}”
        </p>
      )}

      {iv.toyEcho && (
        <span
          className="game-echo pointer-events-none absolute right-[6%] top-[14%] z-0 text-6xl"
          aria-label="A shadow of your favorite toy"
          role="img"
        >
          {ASSETS[iv.toyEcho].emoji}
        </span>
      )}

      {/* target zones */}
      {level.targets.map((t) => {
        const ghosts = level.objects.filter((o) => o.targetId === t.id);
        const open = !!drag || !!selected;
        const isBox = t.shape === "box";
        return (
          <button
            key={t.id}
            type="button"
            aria-label={`Spot: ${t.label}`}
            onClick={() => {
              const obj = level.objects.find((o) => o.id === selected);
              if (obj) attempt(obj, t);
            }}
            className={`absolute z-10 flex items-end justify-center transition-all duration-300 ${
              isBox
                ? `rounded-b-xl border-4 pb-1 ${dark ? "border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-900 shadow-[inset_0_6px_10px_rgba(0,0,0,0.6)]" : "border-[#5a3416] bg-gradient-to-b from-[#c98a45] to-[#8a5426] shadow-[inset_0_6px_10px_rgba(0,0,0,0.35),0_10px_14px_-6px_rgba(0,0,0,0.6)]"} ${open ? "game-box-open" : ""}`
                : `border-2 border-dashed ${t.shape === "circle" ? "rounded-full" : "rounded-lg"} ${
                    dark ? "border-neutral-500 bg-black/30" : "border-amber-100 bg-amber-900/25"
                  }`
            } ${pop === t.id ? "game-pop" : ""} ${falseHint === t.id ? "game-false-hint" : ""} ${
              selected ? "ring-2 ring-amber-200/70" : ""
            }`}
            style={{
              left: `${t.x - t.w / 2}%`,
              top: `${t.y - t.h / 2}%`,
              width: `${t.w}%`,
              height: `${t.h}%`,
            }}
          >
            {!isBox && ghosts[0] && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl opacity-25 grayscale">
                {ASSETS[ghosts[0].asset].emoji}
              </span>
            )}
            {isBox && (
              <span
                className={`text-[10px] font-bold uppercase ${dark ? "text-neutral-400" : "text-amber-950"}`}
              >
                {t.label}
              </span>
            )}
          </button>
        );
      })}

      {/* draggable objects */}
      {level.objects.map((o) => {
        const isPlaced = placed.includes(o.id);
        const dragging = drag?.id === o.id;
        const stolen = iv.colorTheft === o.color;
        const intoBox = isPlaced && !isPlace;
        const { x, y } = posOf(o);
        return (
          <button
            key={o.id}
            type="button"
            aria-label={`${isPlaced ? "Placed" : "Move"} ${o.label}`}
            aria-pressed={selected === o.id}
            onPointerDown={(e) => onDown(e, o)}
            onPointerMove={onMove}
            onPointerUp={() => onUp(o)}
            onPointerCancel={() => setDrag(null)}
            className={`absolute flex touch-none flex-col items-center justify-center rounded-2xl border-2 ${
              dragging ? "z-40 scale-110 shadow-2xl" : isPlaced ? "z-20" : "z-30 shadow-lg"
            } ${stolen ? "border-dashed border-neutral-400" : "border-white/60"} ${
              selected === o.id ? "ring-4 ring-amber-300" : ""
            } ${shake === o.id ? "game-shake" : ""} ${wobble === o.id ? "game-wobble" : ""} ${
              isPlaced ? "pointer-events-none" : done ? "cursor-default" : "cursor-grab"
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${o.size}%`,
              aspectRatio: "1",
              transform: `translate(-50%, -50%) ${intoBox ? "scale(0.2)" : ""}`,
              opacity: intoBox ? 0 : 1,
              backgroundColor: stolen
                ? "#161616"
                : dark
                  ? `${COLOR_HEX[o.color]}aa`
                  : COLOR_HEX[o.color],
              transition: dragging
                ? "none"
                : "left .35s ease, top .35s ease, transform .35s ease, opacity .45s ease",
            }}
          >
            <span
              className={`pointer-events-none text-2xl leading-none ${!isPlaced && !dragging ? "game-bob" : ""}`}
              style={stolen ? { filter: "grayscale(1) brightness(0.7)" } : undefined}
              aria-hidden
            >
              {ASSETS[o.asset].emoji}
            </span>
            <span className="pointer-events-none mt-0.5 text-[9px] font-bold text-white drop-shadow">
              {o.label}
            </span>
          </button>
        );
      })}

      {dark && <div className="game-vignette pointer-events-none absolute inset-0 z-[35]" />}
      {iv.lightDisturbance && (
        <div className="game-light-disturb pointer-events-none absolute inset-0 z-[36]" />
      )}

      <div className="pointer-events-none absolute bottom-1 right-2 z-40 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-neutral-100">
        {Math.min(placed.length, required)}/{required}
      </div>
    </div>
  );
}
