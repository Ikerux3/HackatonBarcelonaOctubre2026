import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { sfx } from "@/game/audio";
import { ASSETS, COLOR_HEX, type AssetId } from "@/game/levels/assets";
import { useCameraShake } from "@/game/cameraShake";
import { observe } from "@/game/observer";
import { zoneCovers, type Point, type SceneObject, type TidyOptions } from "@/game/levels/types";
import type { MinigameProps } from "./types";
import { SceneBackdrop } from "./SceneBackdrop";
import { ToySprite } from "./ToySprite";

const HIT_MARGIN = 5;

/** Small deterministic PRNG so a fixed seed always gives the same toys. */
export function mulberry32(seed: number) {
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

const nearestSlot = (slots: Point[], p: Point) =>
  slots.reduce(
    (best, s, i) =>
      Math.hypot(s.x - p.x, s.y - p.y) < Math.hypot(slots[best]!.x - p.x, slots[best]!.y - p.y)
        ? i
        : best,
    0,
  );

/** Which of the 3 spots hides the last toy — deterministic per seed. */
export function hideSpotIndex(seed: number, count: number): number {
  return Math.floor(mulberry32(seed ^ 0x5eed)() * count);
}

export interface AutoBlackoutInput {
  now: number;
  blackouts: number;
  maxBlackouts: number;
  safeWindowMs: number;
  lightOn: boolean;
  /** the possessed toy sits in a lit spot (frozen) */
  possessedLit: boolean;
  draggingPossessed: boolean;
  lastBlackout: number;
  lastLightOn: number;
  lastDrop: number;
}

/**
 * Automatic blackouts only punish a player who has had light for a full safe
 * window without freezing the toy — never right after switching a light on,
 * never once the toy is frozen, never mid-drag. The scripted first blackout counts.
 */
export function shouldAutoBlackout(i: AutoBlackoutInput): boolean {
  if (i.blackouts >= i.maxBlackouts) return false;
  if (!i.lightOn || i.possessedLit || i.draggingPossessed) return false;
  return i.now - Math.max(i.lastBlackout, i.lastLightOn, i.lastDrop) >= i.safeWindowMs;
}

type Poss = { toyId: string; slot: number };
type Hide = { toyId: string; spot: number; revealed: boolean };

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

  // ── possessed (role 4) ──
  const P = tidy?.possessed;
  const { shakeClass, shake: camShake, raiseTension } = useCameraShake();
  const [poss, setPoss] = useState<Poss | null>(null);
  const [lights, setLights] = useState({ main: true, lamp: false });
  const [eyes, setEyes] = useState(false);
  const [possHint, setPossHint] = useState(false);
  const blackoutsRef = useRef(0);
  const lastBlackoutRef = useRef(0);
  const lastLightOnRef = useRef(0);
  const lastDropRef = useRef(0);
  const lastProgressRef = useRef(0);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const lightsRef = useRef(lights);
  lightsRef.current = lights;
  const possRef = useRef(poss);
  possRef.current = poss;

  // ── hide and seek (role 5) ──
  const H = tidy?.hideSeek;
  const [hide, setHide] = useState<Hide | null>(null);
  const [hideHint, setHideHint] = useState(false);

  const [whisper, setWhisper] = useState<string | null>(null);
  const whisperT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((line: string, ms = 3200) => {
    if (!line) return;
    if (whisperT.current) clearTimeout(whisperT.current);
    setWhisper(line);
    whisperT.current = setTimeout(() => setWhisper(null), ms);
  }, []);
  useEffect(
    () => () => {
      if (whisperT.current) clearTimeout(whisperT.current);
    },
    [],
  );
  const maskId = useId().replace(/:/g, "");

  const litAt = (p: Point, l = lights) =>
    !!P &&
    ((l.main && P.mainZones.some((z) => zoneCovers(z, p))) ||
      (l.lamp && P.lampZones.some((z) => zoneCovers(z, p))));
  const possActive = !!poss && !placed.includes(poss.toyId);

  const total = level.objects.length;
  const step = tidy?.steps[placed.length];
  // the possessed hint only makes sense once its scripted blackout has started
  const hint =
    step?.role === "possessed" && !poss
      ? (tidy?.steps.find((s) => s.role === "plain")?.hint ?? "")
      : step?.hint;

  // start the role for the next toy
  useEffect(() => {
    if (!tidy || !step || placed.length >= total) return;
    if (step.role === "plain" || step.role === "possessed") {
      setCover(null);
      return;
    }
    if (step.role === "hide_seek") {
      setCover(null);
      if (!H || H.spots.length === 0) return;
      const toy = level.objects.find((o) => !placed.includes(o.id));
      if (!toy) return;
      const spot = hideSpotIndex(seed, H.spots.length);
      setSelected(null);
      setPos((p) => ({ ...p, [toy.id]: { x: H.spots[spot]!.x, y: H.spots[spot]!.y } }));
      setHide({ toyId: toy.id, spot, revealed: false });
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
    done ||
    placed.includes(id) ||
    (!!cover && (cover.toyId !== id || !cover.open)) ||
    (possActive && (poss!.toyId !== id || !litAt(P!.slots[poss!.slot]!))) ||
    (!!hide && !placed.includes(hide.toyId) && (hide.toyId !== id || !hide.revealed));

  // ── possessed logic ──
  const blackout = useCallback(
    (first: boolean) => {
      if (!P) return;
      blackoutsRef.current += 1;
      lastBlackoutRef.current = Date.now();
      lastProgressRef.current = Date.now();
      setLights({ main: false, lamp: false });
      setPossHint(false);
      // each blackout raises this minigame's tension: later bursts hit harder
      camShake(2);
      raiseTension(1);
      if (first) sfx.possessed();
      else {
        sfx.blackout();
        observe.blackout();
      }
      setEyes(true);
      setTimeout(() => setEyes(false), 2600);
      // light out mid-drag: the toy slips back to the nearest valid slot
      const d = dragRef.current;
      const cur = possRef.current;
      if (cur && d?.id === cur.toyId) {
        setDrag(null);
        setPoss({ ...cur, slot: nearestSlot(P.slots, d) });
      }
    },
    [P, camShake, raiseTension],
  );

  const possess = (o: SceneObject) => {
    if (!P) return;
    const from = pos[o.id] ?? { x: o.x, y: o.y };
    setSelected(null);
    setPoss({ toyId: o.id, slot: nearestSlot(P.slots, from) });
    observe.possessStart();
    blackout(true);
    say(P.possessLine, 3600);
  };

  // hop between dark slots while unlit
  useEffect(() => {
    if (!possActive || !P) return;
    const t = setInterval(() => {
      const cur = possRef.current;
      if (!cur || dragRef.current?.id === cur.toyId) return;
      const l = lightsRef.current;
      if (litAt(P.slots[cur.slot]!, l)) return; // frozen
      const n = P.slots.length;
      for (let k = 1; k < n; k++) {
        const i = (cur.slot + k) % n;
        if (!litAt(P.slots[i]!, l)) {
          setPoss({ ...cur, slot: i });
          return;
        }
      }
    }, P.moveMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [possActive, P]);

  // automatic blackouts (capped, with a safe window) + stuck hint
  useEffect(() => {
    if (!possActive || !P) return;
    const t = setInterval(() => {
      const now = Date.now();
      const l = lightsRef.current;
      const cur = possRef.current;
      if (
        shouldAutoBlackout({
          now,
          blackouts: blackoutsRef.current,
          maxBlackouts: P.maxBlackouts,
          safeWindowMs: P.safeWindowMs,
          lightOn: l.main || l.lamp,
          possessedLit: !!cur && litAt(P.slots[cur.slot]!, l),
          draggingPossessed: !!cur && dragRef.current?.id === cur.toyId,
          lastBlackout: lastBlackoutRef.current,
          lastLightOn: lastLightOnRef.current,
          lastDrop: lastDropRef.current,
        })
      ) {
        blackout(false);
        return;
      }
      if (now - lastProgressRef.current >= P.hintAfterMs) setPossHint(true);
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [possActive, P, blackout]);

  const toggleLight = (k: "main" | "lamp") => {
    sfx.lightSwitch();
    const on = !lightsRef.current[k];
    if (on) {
      lastLightOnRef.current = Date.now();
      observe.light(k);
    }
    setLights((l) => ({ ...l, [k]: on }));
  };

  // ── hide and seek logic ──
  const hideActive = !!hide && !placed.includes(hide.toyId);
  useEffect(() => {
    if (!hideActive || hide!.revealed || !H) return;
    const spot = H.spots[hide!.spot]!;
    sfx.squeak(spot.x);
    const sq = setInterval(() => sfx.squeak(spot.x), 5000);
    const hint = setTimeout(() => {
      setHideHint(true);
      say(H.hintLine, 4000);
    }, H.hintAfterMs);
    return () => {
      clearInterval(sq);
      clearTimeout(hint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideActive, hide?.revealed]);

  const tapSpot = (i: number) => {
    if (!hide || hide.revealed || !H) return;
    observe.hideSpot(H.spots[i]?.label ?? "", i === hide.spot);
    if (i === hide.spot) {
      sfx.snap();
      setHide({ ...hide, revealed: true });
      setHideHint(false);
    } else {
      sfx.wrong();
      say(H.wrongLine, 1600);
    }
  };

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
    lastDropRef.current = Date.now();
    lastProgressRef.current = Date.now();
    setPlaced((p) => (p.includes(id) ? p : [...p, id]));
    setSelected(null);
    if (cover?.toyId === id) setCover(null);
    if (poss?.toyId === id && P) {
      observe.possessDone();
      setPossHint(false);
      setLights({ main: true, lamp: false });
      say(P.freezeLine, 3200);
    }
  };
  const reject = (id: string, wrongSpot: boolean) => {
    if (wrongSpot) sfx.wrong();
    setShake(id);
    setTimeout(() => setShake(null), 450);
  };

  const posOf = (o: SceneObject) => {
    if (drag?.id === o.id) return { x: drag.x, y: drag.y };
    if (placed.includes(o.id)) return { x: box.x, y: box.y };
    if (poss?.toyId === o.id && P) return P.slots[poss.slot]!;
    return pos[o.id] ?? { x: o.x, y: o.y };
  };

  const onDown = (e: React.PointerEvent, o: SceneObject) => {
    if (step?.role === "possessed" && P && !poss && !done && !cover && !placed.includes(o.id)) {
      e.preventDefault();
      possess(o);
      return;
    }
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
    else if (poss?.toyId === o.id && P) {
      setPoss({ ...poss, slot: nearestSlot(P.slots, d) });
      reject(o.id, false);
    } else {
      observe.wrongDrop();
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
      className={`g-stage relative w-full touch-none select-none overflow-hidden rounded-2xl border ${
        dark ? "game-room-dark border-neutral-800" : "game-room-cozy border-amber-200"
      } ${shakeClass}`}
      style={{ aspectRatio: "2 / 3" }}
    >
      <SceneBackdrop theme={level.theme} dark={dark} />

      {/* hint for the current step */}
      {!done && hint && (
        <p
          className={`pointer-events-none absolute inset-x-0 top-2 z-40 px-3 text-center font-serif text-sm italic drop-shadow-[0_1px_0_rgba(255,255,255,0.6)] ${
            possActive ? "text-neutral-200 drop-shadow-none" : "text-amber-950"
          }`}
        >
          {hint}
        </p>
      )}

      {/* static furniture: the drawer chest is always there */}
      {tidy && (
        <div
          className="pointer-events-none absolute z-0 rounded-md border-4 border-[#3a1f0d] bg-gradient-to-b from-[#8a5a2b] to-[#5a3416] shadow-[0_12px_16px_-8px_rgba(0,0,0,0.7)] bg-[linear-gradient(transparent_48%,rgba(0,0,0,0.35)_48%_52%,transparent_52%),linear-gradient(180deg,#8a5a2b,#5a3416)]"
          style={{
            left: `${tidy.drawer.x - 14}%`,
            top: `${tidy.drawer.y - 9}%`,
            width: "28%",
            height: "18%",
          }}
          aria-hidden
        />
      )}

      {/* hide-and-seek furniture (always part of the room) */}
      {H &&
        H.spots.map((sp, i) => (
          <div
            key={`f-${i}`}
            aria-hidden
            className={`pointer-events-none absolute z-0 -translate-x-1/2 -translate-y-1/2 border-4 ${
              sp.kind === "sofa"
                ? "rounded-t-[40%] rounded-b-lg border-[#3d0f12] bg-gradient-to-b from-[#a8333a] to-[#6e1d22] shadow-[inset_0_4px_0_rgba(255,180,170,0.25),0_14px_16px_-8px_rgba(0,0,0,0.7)]"
                : sp.kind === "drawer"
                  ? "rounded-md border-[#3a1f0d] bg-gradient-to-b from-[#8a5a2b] to-[#5a3416] shadow-[0_10px_12px_-6px_rgba(0,0,0,0.6)]"
                  : "rounded-b-[30%] border-red-950 shadow-[6px_8px_12px_-4px_rgba(0,0,0,0.5)] bg-[repeating-linear-gradient(90deg,var(--color-red-800)_0_6px,var(--color-red-900)_6px_12px)]"
            }`}
            style={{
              left: `${sp.x}%`,
              top: `${sp.y}%`,
              width: sp.kind === "sofa" ? "46%" : sp.kind === "drawer" ? "20%" : "20%",
              height: sp.kind === "sofa" ? "12%" : sp.kind === "drawer" ? "9%" : "22%",
            }}
          />
        ))}

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
          dark ? "border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-900 shadow-[inset_0_6px_10px_rgba(0,0,0,0.6)]" : "border-[#5a3416] bg-gradient-to-b from-[#c98a45] to-[#8a5426] shadow-[inset_0_6px_10px_rgba(0,0,0,0.35),0_10px_14px_-6px_rgba(0,0,0,0.6)]"
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
        const hidden = hide?.toyId === o.id && !hide.revealed && !isPlaced;
        const isPoss = poss?.toyId === o.id && !isPlaced;
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
              isPlaced || hidden ? "pointer-events-none" : ""
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${o.size}%`,
              aspectRatio: "1",
              transform: `translate(-50%, -50%) ${isPlaced ? "scale(0.2)" : ""}`,
              opacity:
                isPlaced || hidden
                  ? 0
                  : isPoss || (lockedNow && !cover && !possActive)
                    ? 1
                    : lockedNow
                      ? 0.55
                      : 1,
              backgroundColor: COLOR_HEX[o.color],
              transition: dragging
                ? "none"
                : isPoss
                  ? "left .9s ease-in-out, top .9s ease-in-out, transform .35s ease"
                  : "left .45s ease, top .45s ease, transform .35s ease, opacity .45s ease",
            }}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 bottom-3 flex items-center justify-center" aria-hidden>
              <ToySprite asset={sprite} possessed={isPoss} />
            </span>
            <span className="pointer-events-none absolute bottom-0.5 text-[9px] font-bold text-white drop-shadow">
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

      {/* possessed: darkness with holes where the active lights reach */}
      {possActive && P && (
        <svg
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          viewBox="0 0 100 150"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${maskId}-g`}>
              <stop offset="0.6" stopColor="black" stopOpacity="1" />
              <stop offset="1" stopColor="black" stopOpacity="0" />
            </radialGradient>
            <mask id={`${maskId}-m`}>
              <rect width="100" height="150" fill="white" />
              {[...(lights.main ? P.mainZones : []), ...(lights.lamp ? P.lampZones : [])].map(
                (z, i) => (
                  <ellipse
                    key={i}
                    cx={z.x}
                    cy={z.y * 1.5}
                    rx={z.r}
                    ry={z.r}
                    fill={`url(#${maskId}-g)`}
                  />
                ),
              )}
            </mask>
          </defs>
          <rect width="100" height="150" fill="black" opacity="0.9" mask={`url(#${maskId}-m)`} />
        </svg>
      )}

      {/* possessed: eyes where the toy hides (only while it is in the dark) */}
      {possActive && P && (eyes || !litAt(P.slots[poss!.slot]!)) && drag?.id !== poss!.toyId && (
        <div
          aria-hidden
          className="game-eyes pointer-events-none absolute z-[35] flex gap-1.5"
          style={{
            left: `${P.slots[poss!.slot]!.x}%`,
            top: `${P.slots[poss!.slot]!.y - 3}%`,
            transform: "translate(-50%, -50%)",
            transition: "left .9s ease-in-out, top .9s ease-in-out",
            opacity: eyes ? 0.9 : 0.45,
          }}
        >
          <span className="h-1.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_var(--color-red-500)]" />
          <span className="h-1.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_var(--color-red-500)]" />
        </div>
      )}

      {/* possessed: light hotspots */}
      {possActive &&
        P &&
        (() => {
          const slot = P.slots[poss!.slot]!;
          const hintKey: "main" | "lamp" | null = !possHint
            ? null
            : P.lampZones.some((z) => zoneCovers(z, slot)) && !lights.lamp
              ? "lamp"
              : !lights.main
                ? "main"
                : "lamp";
          return (["main", "lamp"] as const).map((k) => {
            const at = k === "main" ? P.mainSwitch : P.lamp;
            const on = lights[k];
            return (
              <button
                key={k}
                type="button"
                aria-label={k === "main" ? "Main light switch" : "Small lamp"}
                aria-pressed={on}
                onClick={() => toggleLight(k)}
                className={`absolute z-[45] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 text-xl ${
                  on ? "border-amber-200 bg-amber-300/90" : "border-neutral-500 bg-neutral-800/90"
                } ${hintKey === k ? "animate-pulse ring-4 ring-amber-300" : ""}`}
                style={{ left: `${at.x}%`, top: `${at.y}%` }}
              >
                <span aria-hidden>{k === "main" ? "💡" : "🪔"}</span>
              </button>
            );
          });
        })()}

      {/* hide and seek: clue + tappable spots */}
      {hideActive && H && !hide!.revealed && (
        <>
          {(() => {
            const sp = H.spots[hide!.spot]!;
            const toy = level.objects.find((o) => o.id === hide!.toyId);
            const idx = toy ? level.objects.indexOf(toy) : 0;
            return (
              <div
                aria-hidden
                className={`pointer-events-none absolute z-[26] ${hideHint ? "animate-pulse" : ""}`}
                style={{
                  left: `${sp.x + 8}%`,
                  top: `${sp.y + 4}%`,
                  transform: "translate(-50%,-50%)",
                }}
              >
                <span className="absolute left-1/2 top-full h-2 w-10 -translate-x-1/2 rounded-full bg-black/50 blur-[2px]" />
                <span className="block h-8 w-8 rotate-[28deg] text-xl opacity-90">
                  {toy ? <ToySprite asset={spriteOf(toy, idx)} /> : "❓"}
                </span>
              </div>
            );
          })()}
          {H.spots.map((sp, i) => (
            <button
              key={`s-${i}`}
              type="button"
              aria-label={`Look: ${sp.label}`}
              onClick={() => tapSpot(i)}
              className="absolute z-[25] min-h-12 min-w-12 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-dashed border-amber-100/40"
              style={{
                left: `${sp.x}%`,
                top: `${sp.y}%`,
                width: sp.kind === "sofa" ? "46%" : "22%",
                height: sp.kind === "curtain" ? "22%" : "12%",
              }}
            />
          ))}
        </>
      )}

      {/* monster whisper */}
      {whisper && (
        <p className="game-monster-line pointer-events-none absolute left-1/2 top-10 z-50 w-[90%] -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1 text-center font-serif text-base italic text-red-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {whisper}
        </p>
      )}

      {/* progress, always visible */}
      <div className="pointer-events-none absolute bottom-1 right-2 z-40 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-neutral-100">
        {Math.min(placed.length, total)}/{total}
      </div>
    </div>
  );
}
