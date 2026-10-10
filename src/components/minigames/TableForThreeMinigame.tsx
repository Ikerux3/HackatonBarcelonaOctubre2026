import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import { MonsterOverlay } from "@/components/game/MonsterOverlay";
import { QuestionInput } from "@/components/game/QuestionInput";
import { useGuestVoice } from "@/components/game/GuestVoice";
import { haptic, sfx } from "@/game/audio";
import { spokenLineDurationMs } from "@/game/guestVoice";
import { ASSETS, COLOR_HEX, FOOD_EMOJI } from "@/game/levels/assets";
import {
  tableKind,
  type SceneObject,
  type TableOptions,
  type TableOwner,
  type TableSide,
  type TargetZone,
} from "@/game/levels/types";
import { useCameraShake } from "@/game/cameraShake";
import { useCordura100, useCorduraLight, useCorduraScare } from "@/game/cordura";
import { observe } from "@/game/observer";
import type { MinigameProps } from "./types";

// ── pure rules (exported for tests) ──

export interface TableCtx {
  objects: SceneObject[];
  targets: TargetZone[];
  table: TableOptions;
  childSide: TableSide;
}

const objKind = (ctx: TableCtx, objId: string) =>
  tableKind(ctx.objects.find((o) => o.id === objId)?.asset ?? "ball");
/** A slot's kind is the kind of the object whose targetId points at it. */
const slotKind = (ctx: TableCtx, slotId: string) => {
  const o = ctx.objects.find((x) => x.targetId === slotId);
  return o ? tableKind(o.asset) : null;
};
export const slotOwner = (ctx: TableCtx, slotId: string): TableOwner =>
  ctx.table.sides[slotId] === ctx.childSide ? "child" : "mom";
export const pieceOwner = (ctx: TableCtx, objId: string): TableOwner =>
  ctx.table.owners[objId] ?? "mom";
export const fits = (ctx: TableCtx, objId: string, slotId: string) =>
  objKind(ctx, objId) !== null && objKind(ctx, objId) === slotKind(ctx, slotId);
export const isCorrect = (ctx: TableCtx, slotId: string, objId: string | undefined) =>
  !!objId && fits(ctx, objId, slotId) && pieceOwner(ctx, objId) === slotOwner(ctx, slotId);
export const countCorrect = (ctx: TableCtx, placed: Record<string, string>) =>
  ctx.targets.filter((t) => isCorrect(ctx, t.id, placed[t.id])).length;

/** Two filled slots of the same kind on opposite sides — what the monster swaps. */
export function pickSwap(ctx: TableCtx, placed: Record<string, string>): [string, string] | null {
  for (const a of ctx.targets) {
    for (const b of ctx.targets) {
      if (a.id >= b.id || !placed[a.id] || !placed[b.id]) continue;
      if (ctx.table.sides[a.id] === ctx.table.sides[b.id]) continue;
      if (slotKind(ctx, a.id) === slotKind(ctx, b.id)) return [a.id, b.id];
    }
  }
  return null;
}

// ── component ──

const SYMBOL: Record<TableOwner, string> = { child: "⭐", mom: "👗" };
/** tile width, % of the scene width — size tells whose piece it is */
const TILE: Record<TableOwner | "giant", number> = { child: 13, mom: 17, giant: 24 };
const EMOJI_SIZE: Record<TableOwner | "giant", string> = {
  child: "text-xl",
  mom: "text-2xl",
  giant: "text-4xl",
};

type Scene = "kitchen" | "dining";
type Phase = "collect" | "place" | "place2" | "final";

/**
 * table_for_three — Minigame 02 "La mesa para tres".
 * Kitchen: open cupboards/drawers, collect 6 pieces (giant ones are decoys).
 * Dining: the light lets you place pieces; the dark shows whose place is whose (⭐ you,
 * 👗 mommy) but the monster comes closer: eyes → shake → full scare, which resets only
 * the current phase (checkpoint at N correct). Mid-puzzle the monster asks your favorite
 * food (AI) and it appears on the table; after you leave and come back it swaps two
 * pieces. When everything is right, it sets a third, giant place for itself.
 */
export function TableForThreeMinigame({
  level,
  memory,
  onComplete,
  onRememberFood,
}: MinigameProps) {
  const table = (level.type === "table_for_three" ? level.table : null) as TableOptions;
  const [childSide] = useState<TableSide>(() =>
    table.childSide === "random" ? (Math.random() < 0.5 ? "left" : "right") : table.childSide,
  );
  // mother's dress color is drawn ONCE per run at Play (GameMemory.motherColor) and shown in
  // the intro; the random pick here only covers the editor's playtest
  const [fallbackMomColor] = useState(
    () => table.motherColors[Math.floor(Math.random() * table.motherColors.length)] ?? "pink",
  );
  const momColor = memory.motherColor ?? fallbackMomColor;
  const { shakeClass, shake: camShake, raiseTension } = useCameraShake();
  const ctx: TableCtx = { objects: level.objects, targets: level.targets, table, childSide };
  const childColor =
    memory.favoriteColor && memory.favoriteColor !== "other"
      ? memory.favoriteColor
      : table.childFallbackColor;
  const colorOf = (owner: TableOwner) => (owner === "child" ? childColor : momColor);

  const [scene, setScene] = useState<Scene>("kitchen");
  const [phase, setPhase] = useState<Phase>("collect");
  const [openBox, setOpenBox] = useState<string | null>(null);
  const [collected, setCollected] = useState<string[]>([]);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [light, setLight] = useState(true);
  const [danger, setDanger] = useState(0); // 0 calm · 1 eyes · 2 warning shake
  const [scare, setScare] = useState(false);
  const [forcedDark, setForcedDark] = useState(false);
  const [intruderSeen, setIntruderSeen] = useState(0);
  const [intruders, setIntruders] = useState<number[]>([]);
  const lastPlacementRef = useRef(0);
  const wrongBlackoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (wrongBlackoutRef.current) clearTimeout(wrongBlackoutRef.current);
  }, []);
  const [food, setFood] = useState<{
    status: "none" | "asking" | "shown";
    busy: boolean;
    line: string | null;
    emoji: string | null;
  }>({ status: "none", busy: false, line: null, emoji: null });
  const [inked, setInked] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [illusion, setIllusion] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [whisper, setWhisper] = useState<string | null>(null);
  useGuestVoice(whisper);
  const [showHowTo, setShowHowTo] = useState(false);
  /** the switch pulses until the player has tried the dark once */
  const [triedDark, setTriedDark] = useState(false);
  const checkpoint = useRef<Record<string, string>>({});
  const leftAfterCheckpoint = useRef(false);
  const lastWrongKey = useRef("");
  const finished = useRef(false);
  const swapping = useRef(false);
  const whisperT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shell, setShell] = useState<Element | null>(null);
  useEffect(() => setShell(document.querySelector(".game-shell")), []);

  const say = useCallback((line: string, ms = 3200) => {
    if (!line) return;
    if (whisperT.current) clearTimeout(whisperT.current);
    setWhisper(line);
    whisperT.current = setTimeout(() => setWhisper(null), spokenLineDurationMs(line, ms));
  }, []);
  useEffect(
    () => () => {
      if (whisperT.current) clearTimeout(whisperT.current);
    },
    [],
  );
  const reject = (id: string) => {
    sfx.wrong();
    setShake(id);
    setTimeout(() => setShake(null), 450);
  };

  const placedIds = Object.values(placed);
  const tray = collected.filter((id) => !placedIds.includes(id));
  const correct = countCorrect(ctx, placed);
  const dark = scene === "dining" && (!light || forcedDark);
  const asking = food.status === "asking";
  // Cordura pauses for the food question, the how-to card and the monster's own scenes
  // (full scare, the swap blackout, the third place): only the player's own darkness counts
  useCorduraLight(
    asking || showHowTo || scare || phase === "final" ? null : dark ? "dark" : "lit",
  );
  const corduraScare = useCorduraScare();
  // D44: the bar hit 100 → same reset as this minigame's own scare (only this phase); the
  // game screen already shows the scare, the light comes back on so the bar can drop
  useCordura100(() => {
    if (phase === "final") return;
    setDanger(0);
    setLight(true);
    setSelected(null);
    if (phase === "place" || phase === "place2")
      setPlaced(phase === "place2" ? { ...checkpoint.current } : {});
    say(table.lines.scare);
  });

  // ── danger in the dark: eyes → warning → full scare (resets only this phase) ──
  useEffect(() => {
    const active =
      scene === "dining" && !light && !forcedDark && !asking && !scare && phase !== "final";
    if (!active) {
      setDanger(0);
      return;
    }
    const { eyesMs, shakeMs, scareMs } = table.dark;
    const timers = [
      setTimeout(() => {
        setDanger(1);
        sfx.hum();
        camShake(1);
      }, eyesMs),
      setTimeout(() => {
        setDanger(2);
        haptic([40, 60, 40]);
        camShake(2);
      }, shakeMs),
      // a second warning burst after a pause, only if there's time before the scare
      ...(scareMs - shakeMs > 2600 ? [setTimeout(() => camShake(2), shakeMs + 1500)] : []),
      setTimeout(() => {
        setScare(true);
        sfx.possessed();
        haptic([120, 60, 220]);
        raiseTension(2);
        camShake(3);
        observe.fullScare();
        corduraScare();
        setTimeout(() => {
          setScare(false);
          setDanger(0);
          setLight(true);
          setSelected(null);
          setPlaced(phase === "place2" ? { ...checkpoint.current } : {});
          say(table.lines.scare);
        }, 1600);
      }, table.dark.scareMs),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, light, forcedDark, asking, scare, phase]);

  // ── checkpoint at N correct → the food question ──
  useEffect(() => {
    if (phase !== "place" || correct < table.checkpointAt) return;
    checkpoint.current = Object.fromEntries(
      Object.entries(placed).filter(([slot, obj]) => isCorrect(ctx, slot, obj)),
    );
    setPhase("place2");
    raiseTension(1);
    if (table.food.enabled) {
      setLight(true);
      setSelected(null);
      setFood({ status: "asking", busy: false, line: null, emoji: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correct, phase]);

  // ── the swap: lights go out from inside, two pieces trade places ──
  const doSwap = useCallback(() => {
    if (swapping.current) return;
    const pair = pickSwap(ctx, placed);
    if (!pair) return;
    swapping.current = true;
    setSelected(null);
    setForcedDark(true);
    sfx.blackout();
    setTimeout(() => {
      const [a, b] = pair;
      setPlaced((p) => ({ ...p, [a]: p[b]!, [b]: p[a]! }));
      sfx.snap();
      setTimeout(() => sfx.snap(), 180);
      raiseTension(1);
      camShake(2);
      setForcedDark(false);
      setSwapped(true);
      setIllusion(a);
      say(table.lines.swap, 3800);
      setTimeout(() => setIllusion(null), 4000);
      swapping.current = false;
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed]);

  // coming back to the dining room after the checkpoint
  useEffect(() => {
    if (scene !== "dining" || phase !== "place2" || swapped || !table.swap.enabled) return;
    if (leftAfterCheckpoint.current) doSwap();
  }, [scene, phase, swapped, doSwap, table.swap.enabled]);

  // ── all slots filled: win, swap first, or "something isn't right" ──
  useEffect(() => {
    if (phase !== "place2" || finished.current || asking || swapping.current) return;
    const filled = level.targets.every((t) => placed[t.id]);
    if (!filled) return;
    const allRight = correct === level.targets.length;
    if (allRight && table.swap.enabled && !swapped) {
      doSwap();
      return;
    }
    if (allRight && intruders.length === 0 && (!table.food.enabled || food.status === "shown")) {
      finished.current = true;
      setPhase("final");
      setLight(true);
      sfx.hum();
      const completionDelay = spokenLineDurationMs(table.lines.final, 4200);
      say(table.lines.final, completionDelay);
      setTimeout(() => onComplete?.(), completionDelay);
      return;
    }
    const key = JSON.stringify(placed);
    // right after a swap its own line plays; the player finds out by looking
    if (!allRight && key !== lastWrongKey.current && !illusion) {
      lastWrongKey.current = key;
      say(table.lines.wrong);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, phase, correct, swapped, food.status, asking, intruders.length]);

  // ── actions ──
  const goDining = () => {
    if (collected.length < level.objects.length) return void say(table.lines.needAll);
    sfx.click();
    setOpenBox(null);
    setScene("dining");
    if (phase === "collect") {
      setPhase("place");
      // first time in the dining room: explain the light/dark rule once
      if (table.hints.howTo?.length) setShowHowTo(true);
    }
  };
  const goKitchen = () => {
    if (swapping.current || asking || phase === "final") return;
    sfx.click();
    setSelected(null);
    setLight(true);
    setScene("kitchen");
    if (phase === "place2") leftAfterCheckpoint.current = true;
  };
  const take = (id: string) => {
    if (collected.includes(id)) return;
    sfx.snap();
    setCollected((c) => [...c, id]);
  };
  const triggerWrongBlackout = () => {
    if (wrongBlackoutRef.current) return;
    sfx.blackout();
    setSelected(null);
    setForcedDark(true);
    if (intruderSeen < 3) {
      setIntruders((old) => [...old, intruderSeen]);
      setIntruderSeen((old) => old + 1);
    }
    say("Three seconds in the dark. Remember the marks.", 3200);
    wrongBlackoutRef.current = setTimeout(() => {
      setForcedDark(false);
      wrongBlackoutRef.current = null;
    }, 3000);
  };
  const tapSlot = (slotId: string) => {
    if (dark || asking || phase === "final" || swapping.current) return;
    if (!selected) {
      // tap a placed piece to take it back
      if (placed[slotId]) {
        sfx.click();
        setPlaced((p) => Object.fromEntries(Object.entries(p).filter(([s]) => s !== slotId)));
      }
      return;
    }
    if (!isCorrect(ctx, slotId, selected)) {
      reject(selected);
      triggerWrongBlackout();
      return;
    }
    const now = Date.now();
    if (now - lastPlacementRef.current < 1200) sfx.knock();
    lastPlacementRef.current = now;
    sfx.snap();
    setPlaced((p) => ({ ...p, [slotId]: selected }));
    setSelected(null);
  };
  const submitFood = async (answer: string) => {
    setFood((f) => ({ ...f, busy: true }));
    sfx.hum();
    const r = await interpretAnswerSafe({
      questionType: "favorite_food",
      answer,
      memory: {
        ...(memory.favoriteColor ? { favoriteColor: memory.favoriteColor } : {}),
        ...(memory.favoriteToy ? { favoriteToy: memory.favoriteToy } : {}),
      },
    });
    const cat = r.normalizedFood ?? "other";
    if (cat !== "other") onRememberFood?.(cat);
    setFood({ status: "asking", busy: false, line: r.monsterLine, emoji: FOOD_EMOJI[cat] });
  };
  const closeFood = () => {
    sfx.click();
    setFood((f) => ({ ...f, status: "shown" }));
    setTimeout(() => {
      setInked(true);
      sfx.odd();
    }, 2600);
  };

  // ── rendering helpers ──
  const Piece = ({ id, dim }: { id: string; dim?: boolean }) => {
    const o = level.objects.find((x) => x.id === id)!;
    const owner = pieceOwner(ctx, id);
    return (
      <span
        className={`relative flex aspect-square items-center justify-center rounded-xl border-2 border-white/70 shadow-md ${shake === id ? "game-shake" : ""}`}
        style={{
          width: "100%",
          backgroundColor: COLOR_HEX[colorOf(owner)],
          opacity: dim ? 0.35 : 1,
        }}
      >
        <span className={`${EMOJI_SIZE[owner]} leading-none`}>{ASSETS[o.asset].emoji}</span>
        <span className="absolute -right-1 -top-1 rounded-full bg-white/90 px-0.5 text-[10px] leading-tight">
          {SYMBOL[owner]}
        </span>
      </span>
    );
  };

  const hint = asking
    ? null
    : scene === "kitchen"
      ? phase === "collect"
        ? table.hints.kitchen
        : null
      : dark && !forcedDark
        ? table.hints.dark
        : phase === "place"
          ? table.hints.dining
          : phase === "place2"
            ? table.hints.finish
            : null;

  const foodLayer = asking && (
    <div className="absolute inset-0 z-[70]">
      <MonsterOverlay
        line={food.line}
        voiceLine={food.busy ? null : (food.line ?? table.food.question)}
      >
        <QuestionInput
          question={table.food.question}
          busy={food.busy}
          monsterLine={food.line}
          onSubmit={(a) => void submitFood(a)}
          onContinue={closeFood}
        />
      </MonsterOverlay>
    </div>
  );

  return (
    <div
      className={`g-stage relative w-full touch-none select-none overflow-hidden rounded-2xl border border-neutral-800 ${shakeClass}`}
      style={{ aspectRatio: "2 / 3" }}
    >
      {scene === "kitchen" ? <KitchenBackdrop /> : <DiningBackdrop final={phase === "final"} childColor={COLOR_HEX[childColor]} momColor={COLOR_HEX[momColor]} childSide={childSide} />}

      {/* hint */}
      {hint && (
        <p
          className={`pointer-events-none absolute inset-x-0 top-2 z-[45] px-3 text-center font-serif text-sm italic ${dark ? "text-neutral-200" : "text-amber-950"}`}
        >
          {hint}
        </p>
      )}

      {/* ── kitchen ── */}
      {scene === "kitchen" &&
        table.containers.map((c) => {
          const left = c.contents.filter((id) => !collected.includes(id));
          return (
            <button
              key={c.id}
              type="button"
              aria-label={`Open ${c.label}`}
              onClick={() => {
                sfx.click();
                setOpenBox(c.id);
              }}
              className={`absolute z-10 flex items-center justify-center border-4 border-amber-950 shadow-md active:scale-95 ${
                c.kind === "drawer" ? "rounded-md bg-amber-700" : "rounded-lg bg-amber-800"
              }`}
              style={{
                left: `${c.x - c.w / 2}%`,
                top: `${c.y - c.h / 2}%`,
                width: `${c.w}%`,
                height: `${c.h}%`,
              }}
            >
              <span
                className={
                  c.kind === "drawer"
                    ? "h-1.5 w-8 rounded-full bg-amber-300"
                    : "h-6 w-1.5 rounded-full bg-amber-300"
                }
                aria-hidden
              />
              {left.length === 0 && (
                <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-amber-200/80">
                  empty
                </span>
              )}
            </button>
          );
        })}
      {scene === "kitchen" && (
        <button
          type="button"
          onClick={goDining}
          aria-label="Go to the dining room"
          className={`absolute z-20 min-h-12 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-2 text-xs font-bold shadow-lg active:scale-95 ${
            collected.length >= level.objects.length
              ? "animate-pulse border-amber-200 bg-amber-900 text-amber-50"
              : "border-amber-900/40 bg-amber-200/80 text-amber-900/70"
          }`}
          style={{ left: `${table.doors.toDining.x}%`, top: `${table.doors.toDining.y}%` }}
        >
          Dining →
        </button>
      )}
      {scene === "kitchen" && openBox && (
        <div className="absolute inset-x-[6%] top-[24%] z-30 rounded-2xl border-4 border-amber-950 bg-amber-50 p-3 shadow-2xl">
          <p className="mb-2 text-center font-serif text-sm font-bold text-amber-950">
            {table.containers.find((c) => c.id === openBox)?.label}
          </p>
          <div className="flex flex-wrap items-end justify-center gap-2">
            {table.containers
              .find((c) => c.id === openBox)!
              .contents.filter((id) => !collected.includes(id))
              .map((id) => {
                const decoy = table.decoys.find((d) => d.id === id);
                if (decoy)
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-label={decoy.label}
                      onClick={() => {
                        reject(id);
                        say(table.lines.decoy);
                      }}
                      className={`flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-neutral-500 bg-neutral-300 ${shake === id ? "game-shake" : ""}`}
                      style={{ width: `${TILE.giant * 1.6}%` }}
                    >
                      <span className={`${EMOJI_SIZE.giant} leading-none grayscale`}>
                        {ASSETS[decoy.asset].emoji}
                      </span>
                    </button>
                  );
                const owner = pieceOwner(ctx, id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Take ${level.objects.find((o) => o.id === id)?.label}`}
                    onClick={() => take(id)}
                    style={{ width: `${TILE[owner] * 1.6}%` }}
                  >
                    <Piece id={id} />
                  </button>
                );
              })}
            {table.containers
              .find((c) => c.id === openBox)!
              .contents.every((id) => collected.includes(id)) && (
              <p className="text-sm italic text-amber-900/70">Nothing left here.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpenBox(null)}
            className="mx-auto mt-3 block min-h-11 rounded-lg bg-amber-900 px-5 text-sm font-bold text-amber-50 active:scale-95"
          >
            Close
          </button>
        </div>
      )}

      {/* ── dining ── */}
      {scene === "dining" &&
        level.targets.map((t) => {
          const kind = slotKind(ctx, t.id);
          const owner = slotOwner(ctx, t.id);
          const pieceId = placed[t.id];
          const showMarks = !light || forcedDark;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={
                showMarks
                  ? `${owner === "child" ? "Your" : "Mommy's"} ${kind} spot`
                  : `${table.sides[t.id]} ${kind} spot`
              }
              onClick={() => tapSlot(t.id)}
              className={`absolute flex items-center justify-center ${kind === "cutlery" ? "rounded-lg" : "rounded-full"} ${
                showMarks
                  ? "z-40 border-[3px]"
                  : `z-10 border-2 border-dashed ${selected && fits(ctx, selected, t.id) ? "border-amber-100 bg-amber-100/20" : "border-amber-950/40"}`
              }`}
              style={{
                left: `${t.x - t.w / 2}%`,
                top: `${t.y - t.h / 2}%`,
                width: `${t.w}%`,
                height: `${t.h}%`,
                ...(showMarks
                  ? {
                      borderColor: COLOR_HEX[colorOf(owner)],
                      boxShadow: `0 0 14px 3px ${COLOR_HEX[colorOf(owner)]}aa`,
                    }
                  : {}),
              }}
            >
              {showMarks ? (
                <span className="flex flex-col items-center leading-none">
                  <span className="text-xl">{SYMBOL[owner]}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-200">
                    {owner === "child" ? "small" : "medium"}
                  </span>
                </span>
              ) : (
                pieceId && (
                  <span
                    className={illusion === t.id ? "game-wobble" : ""}
                    style={{
                      width: `${(TILE[pieceOwner(ctx, pieceId)] / t.w) * 100 * (illusion === t.id ? 1.35 : 1)}%`,
                    }}
                  >
                    <Piece id={pieceId} />
                  </span>
                )
              )}
            </button>
          );
        })}

      {/* Monster: at most one new corrupt place item on each intentional blackout. */}
      {scene === "dining" && intruders.map((id) => (
        <button key={id} type="button"
          disabled={!light || forcedDark || asking}
          onClick={() => { sfx.snap(); setIntruders((v) => v.filter((x) => x !== id)); }}
          aria-label={"Remove corrupt " + (["plate", "fork", "glass"][id] ?? "item")}
          className="absolute z-[42] flex h-12 w-12 items-center justify-center rounded-xl border-2 border-red-400 bg-black/80 text-3xl disabled:opacity-60"
          style={{ top: (33 + id * 10) + "%", left: "48%" }}>
          {["🍽️", "🍴", "🥛"][id]}
        </button>
      ))}

      {/* the favorite food, then the monster's ink */}
      {scene === "dining" && food.status === "shown" && food.emoji && (
        <span
          className="pointer-events-none absolute left-1/2 top-[47%] z-20 -translate-x-1/2 -translate-y-1/2 text-4xl transition-all duration-1000"
          style={inked ? { filter: "grayscale(1) brightness(0.35)" } : undefined}
          aria-label="Your favorite food"
          role="img"
        >
          {food.emoji}
          {inked && (
            <span className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.85)_30%,transparent_70%)]" />
          )}
        </span>
      )}

      {/* the third, giant place it sets for itself */}
      {scene === "dining" && phase === "final" && (
        <div
          className="pointer-events-none absolute left-1/2 top-[30%] z-20 flex -translate-x-1/2 items-end gap-1 animate-in fade-in duration-1000"
          aria-label="A third, giant place has been set"
          role="img"
        >
          <span className="text-3xl grayscale">🍴</span>
          <span className="text-5xl grayscale">🍽️</span>
          <span className="text-3xl grayscale">🥛</span>
        </div>
      )}

      {scene === "dining" && (
        <>
          <button
            type="button"
            onClick={goKitchen}
            aria-label="Go to the kitchen"
            className="absolute z-[45] min-h-12 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-amber-900/50 bg-amber-100/90 px-2 text-xs font-bold text-amber-950 active:scale-95"
            style={{ left: `${table.doors.toKitchen.x}%`, top: `${table.doors.toKitchen.y}%` }}
          >
            ← Kitchen
          </button>
          <button
            type="button"
            onClick={() => {
              if (asking || forcedDark || scare || phase === "final" || showHowTo) return;
              sfx.lightSwitch();
              setSelected(null);
              if (light) {
                setTriedDark(true);
                if (intruderSeen < 3) {
                  setIntruders((old) => [...old, intruderSeen]);
                  setIntruderSeen((old) => old + 1);
                  sfx.knock();
                }
              }
              setLight((v) => !v);
            }}
            aria-label={light ? "Turn the light off" : "Turn the light on"}
            aria-pressed={light}
            className={`absolute z-[45] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 text-xl ${
              light
                ? `border-amber-200 bg-amber-300/90 ${triedDark ? "" : "animate-pulse ring-4 ring-amber-400"}`
                : "animate-pulse border-amber-200 bg-neutral-800"
            }`}
            style={{ left: `${table.lightSwitch.x}%`, top: `${table.lightSwitch.y}%` }}
          >
            💡
          </button>
        </>
      )}

      {/* darkness (marks render above it) */}
      {dark && <div className="pointer-events-none absolute inset-0 z-30 bg-black/90" />}
      {/* in the dark the chairs glow in their owner's color too (mom = her dress color) */}
      {scene === "dining" &&
        (!light || forcedDark) &&
        (["left", "right"] as const).map((side) => {
          const owner: TableOwner = side === childSide ? "child" : "mom";
          return (
            <div
              key={side}
              aria-hidden
              className="pointer-events-none absolute top-[67%] z-40 h-[10%] w-[20%] rounded-b-lg rounded-t-md border-[3px]"
              style={{
                [side]: "19%",
                borderColor: COLOR_HEX[colorOf(owner)],
                boxShadow: `0 0 12px 2px ${COLOR_HEX[colorOf(owner)]}88`,
              }}
            />
          );
        })}
      {scene === "dining" && (danger >= 1 || forcedDark) && (
        <div
          className="game-eyes pointer-events-none absolute left-[18%] top-[20%] z-[41] flex gap-2"
          aria-hidden
        >
          <span className="h-2 w-3 rounded-full bg-red-500 shadow-[0_0_8px_var(--color-red-500)]" />
          <span className="h-2 w-3 rounded-full bg-red-500 shadow-[0_0_8px_var(--color-red-500)]" />
        </div>
      )}

      {/* tray: what you've collected */}
      <div className="absolute inset-x-[3%] bottom-[2%] z-[42] flex h-[13%] items-center justify-center gap-1.5 rounded-2xl border-2 border-amber-900/40 bg-amber-200/80 px-2">
        <span className="absolute -top-2.5 left-2 rounded-full bg-amber-900 px-2 text-[10px] font-bold text-amber-50">
          {scene === "kitchen"
            ? `Found ${collected.length}/${level.objects.length}`
            : `On the table ${placedIds.length}/${level.targets.length}`}
        </span>
        {tray.length === 0 && (
          <span className="text-xs italic text-amber-900/70">
            {scene === "kitchen" ? "Open the cupboards and drawers" : "Tray empty"}
          </span>
        )}
        {tray.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={`Select ${level.objects.find((o) => o.id === id)?.label}`}
            aria-pressed={selected === id}
            onClick={() => {
              if (scene !== "dining" || dark || asking) return;
              sfx.click();
              setSelected((s) => (s === id ? null : id));
            }}
            className={`rounded-xl ${selected === id ? "ring-4 ring-amber-500" : ""}`}
            style={{ width: `${TILE[pieceOwner(ctx, id)]}%` }}
          >
            <Piece id={id} dim={dark} />
          </button>
        ))}
      </div>

      {/* monster whisper */}
      {whisper && (
        <p className="game-monster-line pointer-events-none absolute left-1/2 top-10 z-50 w-[90%] -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1 text-center font-serif text-base italic text-red-300">
          {whisper}
        </p>
      )}

      {/* full scare */}
      {scare && (
        <div
          className="absolute inset-0 z-[65] flex items-center justify-center bg-black"
          aria-hidden
        >
          <div className="game-eyes flex gap-10">
            <span className="h-10 w-16 rounded-full bg-red-600 shadow-[0_0_40px_12px_var(--color-red-600)]" />
            <span className="h-10 w-16 rounded-full bg-red-600 shadow-[0_0_40px_12px_var(--color-red-600)]" />
          </div>
        </div>
      )}

      {/* how it works — shown once, the first time in the dining room */}
      {showHowTo && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full rounded-2xl border-4 border-amber-900 bg-amber-50 p-4 text-amber-950 shadow-2xl">
            <p className="mb-2 text-center font-serif text-lg font-bold">Setting the table</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-snug">
              {table.hints.howTo?.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => {
                sfx.click();
                setShowHowTo(false);
              }}
              className="mx-auto mt-4 block min-h-12 rounded-xl bg-amber-900 px-6 text-base font-bold text-amber-50 active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* the food question covers the whole phone screen (keyboard-safe) */}
      {foodLayer && (shell ? createPortal(foodLayer, shell) : foodLayer)}
    </div>
  );
}

function KitchenBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[52%] bg-amber-100" />
      <div className="absolute inset-x-0 bottom-0 h-[48%] bg-orange-200" />
      {/* window */}
      <div className="absolute left-1/2 top-[4%] h-[10%] w-[22%] -translate-x-1/2 rounded-md border-4 border-amber-300 bg-sky-200" />
      {/* counter */}
      <div className="absolute inset-x-[4%] top-[45%] h-[5%] rounded-sm bg-stone-400 shadow" />
      <div className="absolute inset-x-[4%] top-[50%] h-[30%] bg-amber-900/30" />
    </div>
  );
}

function DiningBackdrop({
  final, childColor, momColor, childSide,
}: { final: boolean; childColor: string; momColor: string; childSide: TableSide }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[62%] bg-amber-100" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-orange-200" />
      <div className="absolute left-1/2 top-[3%] flex -translate-x-1/2 flex-col items-center">
        <div className="h-5 w-0.5 bg-amber-500" />
        <div className="game-lamp-glow h-5 w-14 rounded-t-full bg-yellow-300" />
      </div>
      {/* chairs: two, and a third when it's done */}
      <div className="absolute left-[19%] top-[67%] h-[10%] w-[20%] rounded-b-lg rounded-t-md border-2 border-amber-900" style={{ backgroundColor: childSide === "left" ? childColor : momColor }} />
      <div className="absolute right-[19%] top-[67%] h-[10%] w-[20%] rounded-b-lg rounded-t-md border-2 border-amber-900" style={{ backgroundColor: childSide === "right" ? childColor : momColor }} />
      {final && (
        <div className="absolute left-1/2 top-[14%] h-[14%] w-[30%] -translate-x-1/2 rounded-t-lg bg-neutral-900 animate-in fade-in duration-1000" />
      )}
      {/* tabletop */}
      <div className="absolute left-[6%] right-[6%] top-[27%] h-[40%] rounded-[2rem] border-4 border-amber-800 bg-amber-700 shadow-xl" />
    </div>
  );
}
