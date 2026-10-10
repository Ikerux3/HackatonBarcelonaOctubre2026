import { useCallback, useEffect, useRef, useState } from "react";

import { useGuestVoice } from "@/components/game/GuestVoice";
import { sfx } from "@/game/audio";
import { useCameraShake } from "@/game/cameraShake";
import { useCordura100, useCorduraLight } from "@/game/cordura";
import type { GuestVoiceRole } from "@/game/guestVoice";
import { ASSETS, type AssetId } from "@/game/levels/assets";
import type { MomRoomOptions, Point } from "@/game/levels/types";
import { momCode, pressPanel, withName } from "@/game/momRoom";
import { SceneBackdrop } from "./SceneBackdrop";
import type { MinigameProps } from "./types";

type Phase = "call" | "room" | "exit";
/** a line on screen; `voice` null = narration (subtitle only, nobody speaks it) */
type Line = { text: string; voice: GuestVoiceRole | null };

/** the "Go to mom's room" button shows up once the call has been heard */
const CALL_BUTTON_MS = 1500;
/** door opens → the wardrobe creaks open → The Guest's goodbye → the task ends */
const EXIT_WARDROBE_MS = 900;
const EXIT_DONE_MS = 4600;

const at = (p: Point) => ({ left: `${p.x}%`, top: `${p.y}%` });

/**
 * mom_room (Minigame 04, Drive D42/D45): mom's voice — not quite hers — calls the child by
 * name for the first time. The door shuts behind them. In the dark, white marks show on
 * the photo, the little box and the clock; with the light on, the vanity card gives their
 * order and the drawer panel takes the code. Drawer → key → door → "leaving already?".
 * A wrong code costs nothing; the key, once taken, is never lost.
 */
export function MomRoomMinigame({ level, memory, onComplete }: MinigameProps) {
  const mr = (level.type === "mom_room" ? level.momRoom : null) as MomRoomOptions | null;
  const stand = level.targets[0]!;
  const code = mr ? momCode(mr) : [];
  const name = memory.playerName;
  const { shakeClass, shake: camShake, raiseTension } = useCameraShake();

  const [phase, setPhase] = useState<Phase>("call");
  const [canGo, setCanGo] = useState(false);
  const [light, setLight] = useState(true);
  const [triedDark, setTriedDark] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [input, setInput] = useState<AssetId[]>([]);
  const inputRef = useRef(input);
  inputRef.current = input;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [rattle, setRattle] = useState<"door" | "wardrobe" | "panel" | null>(null);

  const [line, setLine] = useState<Line | null>(null);
  useGuestVoice(line?.text, !!line?.voice, 0, undefined, line?.voice ?? "guest");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const lineT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string, voice: GuestVoiceRole | null, ms = 3200) => {
    if (!text) return;
    if (lineT.current) clearTimeout(lineT.current);
    setLine({ text, voice });
    lineT.current = setTimeout(() => setLine(null), ms);
  }, []);
  const shakeIt = (what: "door" | "wardrobe" | "panel") => {
    setRattle(what);
    later(450, () => setRattle((r) => (r === what ? null : r)));
  };

  // D45: the first time The Guest says the child's name — with mom's borrowed voice
  useEffect(() => {
    if (mr) say(withName(mr.lines.call, name), "mom_impostor", 60_000);
    later(CALL_BUTTON_MS, () => setCanGo(true));
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      if (lineT.current) clearTimeout(lineT.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cordura only counts inside the room (the call and the exit are cutscenes)
  useCorduraLight(phase === "room" ? (light ? "lit" : "dark") : null);
  // D44: the bar hit 100 → only the panel being typed is reset; the key stays in the pocket
  useCordura100(() => {
    if (phase !== "room") return;
    setPanelOpen(false);
    setCardOpen(false);
    setInput([]);
    setLight(true);
  });

  if (!mr) return null;

  const enter = () => {
    sfx.door();
    camShake(2);
    raiseTension(1);
    setLine(null);
    setPhase("room");
  };

  const toggleLight = () => {
    if (phase !== "room") return;
    sfx.lightSwitch();
    if (light) {
      setTriedDark(true);
      // the card and the panel need the light
      setCardOpen(false);
      setPanelOpen(false);
      setInput([]);
    }
    setLight((v) => !v);
  };

  const openCard = () => {
    if (phase !== "room") return;
    if (!light) return say(mr.lines.tooDark, null);
    sfx.click();
    setCardOpen(true);
  };

  const openPanel = () => {
    if (phase !== "room" || drawerOpen) return;
    if (!light) return say(mr.lines.tooDark, null);
    sfx.click();
    setPanelOpen(true);
  };

  const press = (symbol: AssetId) => {
    if (!light || drawerOpen) return;
    const r = pressPanel(inputRef.current, symbol, code);
    inputRef.current = r.input;
    setInput(r.input);
    if (r.result === "ok") sfx.click();
    else if (r.result === "wrong") {
      sfx.wrong();
      shakeIt("panel");
      say(withName(mr.lines.wrong, name), "mom_impostor");
    } else {
      sfx.success();
      camShake(1);
      raiseTension(1);
      setPanelOpen(false);
      setDrawerOpen(true);
      say(mr.lines.drawer, null);
    }
  };

  const takeKey = () => {
    sfx.snap();
    setHasKey(true);
  };

  const tryDoor = () => {
    if (phase !== "room") return;
    if (!hasKey) {
      sfx.knock();
      shakeIt("door");
      return say(mr.lines.locked, null);
    }
    setPhase("exit");
    setCardOpen(false);
    setPanelOpen(false);
    setDoorOpen(true);
    sfx.door();
    later(EXIT_WARDROBE_MS, () => {
      setWardrobeOpen(true);
      sfx.hum();
      camShake(2);
      say(withName(mr.lines.leaving, name), "mom_impostor", EXIT_DONE_MS);
    });
    later(EXIT_DONE_MS, () => onComplete?.());
  };

  const tryWardrobe = () => {
    if (phase !== "room") return;
    sfx.knock();
    shakeIt("wardrobe");
    say(withName(mr.lines.wardrobe, name), "mom_impostor");
  };

  const hint =
    phase === "call"
      ? mr.hints.call
      : phase === "exit"
        ? ""
        : hasKey
          ? mr.hints.key
          : light
            ? mr.hints.room
            : mr.hints.dark;
  const markLabel = (id: string) => ASSETS[mr.marks[id] ?? "flower"].label.toLowerCase();

  return (
    <div
      className={`g-stage relative w-full touch-none select-none overflow-hidden rounded-2xl border border-neutral-800 ${shakeClass}`}
      style={{ aspectRatio: "2 / 3" }}
      role="application"
      aria-label="Mom's bedroom. The door is locked. Light off to see the marks, on to use the card and the drawer."
    >
      <SceneBackdrop theme={level.theme} dark={false} />

      {/* ── mom's furniture, over the bedroom art ── */}
      {/* vanity with its mirror (the card lies on it) */}
      <div className="pointer-events-none absolute left-[7%] top-[4%] h-[43%] w-[32%]" aria-hidden>
        <div className="absolute inset-x-[4%] top-0 h-[54%] rounded-[50%] border-[5px] border-[#8a5a2b] bg-gradient-to-br from-[#5b6b86] to-[#232c3d] shadow-[inset_0_0_18px_rgba(0,0,0,0.7)]">
          <div className="absolute left-[22%] top-[14%] h-[40%] w-[12%] rotate-12 rounded-full bg-white/20" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[46%] rounded-md border-4 border-[#3a1f0d] bg-gradient-to-b from-[#9a6233] to-[#6e4223] shadow-[0_10px_16px_-8px_rgba(0,0,0,0.7)]">
          <div className="absolute inset-x-[10%] top-[55%] h-[2px] bg-black/40" />
        </div>
      </div>
      {/* mom's bed (covers the child's) */}
      <div
        className="pointer-events-none absolute left-[2%] top-[46%] h-[27%] w-[64%] rounded-xl border-4 border-[#3a1f0d] bg-gradient-to-b from-[#8a3a5a] to-[#5a2440] shadow-[0_12px_14px_-6px_rgba(0,0,0,0.6)]"
        aria-hidden
      >
        <div className="absolute left-[6%] top-[8%] h-[30%] w-[38%] rounded-lg bg-gradient-to-b from-[#fffaf0] to-[#e4dccb]" />
        <div className="absolute right-[6%] top-[8%] h-[30%] w-[38%] rounded-lg bg-gradient-to-b from-[#fffaf0] to-[#e4dccb]" />
      </div>
      {/* the door (back wall) */}
      <button
        type="button"
        onClick={tryDoor}
        aria-label={hasKey ? "Unlock the door with the key" : "The door"}
        className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-t-md border-4 border-[#3a1f0d] shadow-[0_10px_16px_-8px_rgba(0,0,0,0.7)] ${
          doorOpen ? "bg-black" : "bg-gradient-to-b from-[#7a4a26] to-[#55301a]"
        } ${rattle === "door" ? "game-shake" : ""} ${hasKey && !doorOpen ? "ring-4 ring-amber-300 motion-safe:animate-pulse" : ""}`}
        style={{ ...at(mr.door), width: "17%", height: "37%" }}
      >
        {!doorOpen && (
          <>
            <span className="absolute inset-x-[14%] top-[8%] h-[34%] rounded-sm border-2 border-black/30" />
            <span className="absolute inset-x-[14%] bottom-[8%] h-[34%] rounded-sm border-2 border-black/30" />
            <span className="absolute right-[12%] top-1/2 h-2 w-2 rounded-full bg-[#e7c77a]" />
          </>
        )}
      </button>
      {/* the wardrobe (over the bedroom art's): opens a crack at the very end */}
      <button
        type="button"
        onClick={tryWardrobe}
        aria-label="The wardrobe"
        className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-t-lg ${rattle === "wardrobe" ? "game-shake" : ""}`}
        style={{ ...at(mr.wardrobe), width: "24%", height: "46%" }}
      >
        {wardrobeOpen && (
          <span className="absolute inset-y-2 left-[44%] w-[20%] bg-black" aria-hidden>
            <span className="absolute left-1/2 top-[38%] flex -translate-x-1/2 gap-1.5">
              <span className="h-1.5 w-2.5 animate-pulse rounded-full bg-red-600 shadow-[0_0_10px_3px_var(--color-red-600)]" />
              <span className="h-1.5 w-2.5 animate-pulse rounded-full bg-red-600 shadow-[0_0_10px_3px_var(--color-red-600)]" />
            </span>
          </span>
        )}
      </button>
      {/* nightstand + its drawer (the lock panel) */}
      <div
        className="pointer-events-none absolute z-10 rounded-md border-4 border-[#3a1f0d] bg-gradient-to-b from-[#8a5a2b] to-[#5a3416] shadow-md"
        style={{
          left: `${stand.x - stand.w / 2}%`,
          top: `${stand.y - stand.h / 2}%`,
          width: `${stand.w}%`,
          height: `${stand.h}%`,
        }}
        aria-hidden
      />
      <button
        type="button"
        onClick={openPanel}
        aria-label={drawerOpen ? "The drawer is open" : "The drawer's lock panel"}
        className={`absolute z-20 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded border-2 border-[#3a1f0d] px-2 text-xs font-bold ${
          drawerOpen ? "bg-black/70 text-amber-200" : "bg-[#6e4223] text-amber-100"
        } ${rattle === "panel" ? "game-shake" : ""}`}
        style={{ ...at(mr.drawer), width: "30%" }}
      >
        {drawerOpen ? (
          "open"
        ) : (
          <>
            <span aria-hidden>🔒</span>
            {code.map((_, i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-amber-200/60" aria-hidden />
            ))}
          </>
        )}
      </button>
      {drawerOpen && !hasKey && (
        <button
          type="button"
          onClick={takeKey}
          aria-label="Take the key"
          className="absolute z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-300/90 text-2xl ring-4 ring-amber-400 motion-safe:animate-pulse"
          style={at(mr.drawer)}
        >
          🗝️
        </button>
      )}
      {/* the card on the vanity */}
      <button
        type="button"
        onClick={openCard}
        aria-label="A card on the vanity"
        className="absolute z-20 flex h-11 w-16 -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] items-center justify-center rounded-sm border border-amber-900/40 bg-amber-50 text-[10px] font-bold text-amber-950 shadow-md"
        style={at(mr.card)}
      >
        ✉️
      </button>

      {/* the clue objects: plain things in the light, white marks in the dark */}
      {level.objects.map((o) => (
        <div
          key={o.id}
          role="img"
          aria-label={light ? o.label : `${o.label} — a white ${markLabel(o.id)} is drawn on it`}
          className="absolute z-20 flex items-center justify-center rounded-xl border-2 border-amber-950/40 bg-amber-100/80 shadow-md"
          style={{
            left: `${o.x}%`,
            top: `${o.y}%`,
            width: `${o.size}%`,
            aspectRatio: "1",
            transform: "translate(-50%, -50%)",
          }}
        >
          <span className="text-2xl leading-none" aria-hidden>
            {ASSETS[o.asset].emoji}
          </span>
        </div>
      ))}

      {/* darkness */}
      {!light && phase === "room" && (
        <div className="pointer-events-none absolute inset-0 z-30 bg-black/85" />
      )}
      {/* in the dark: each object, faint, with its white mark drawn on it */}
      {!light &&
        phase === "room" &&
        level.objects.map((o) => (
          <span
            key={o.id}
            className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.size}%`, aspectRatio: "1" }}
            aria-hidden
          >
            <span className="absolute inset-0 flex items-center justify-center text-2xl leading-none opacity-40">
              {ASSETS[o.asset].emoji}
            </span>
            <span
              className="absolute -right-1 -top-2 text-2xl leading-none"
              style={{
                filter: "grayscale(1) brightness(2.4) drop-shadow(0 0 8px rgba(255,255,255,0.9))",
              }}
            >
              {ASSETS[mr.marks[o.id] ?? "flower"].emoji}
            </span>
          </span>
        ))}

      {phase !== "call" && (
        <button
          type="button"
          onClick={toggleLight}
          aria-label={light ? "Turn the light off" : "Turn the light on"}
          aria-pressed={light}
          className={`absolute z-[45] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 text-xl ${
            light
              ? `border-amber-200 bg-amber-300/90 ${triedDark || phase === "exit" ? "" : "animate-pulse ring-4 ring-amber-400"}`
              : "animate-pulse border-amber-200 bg-neutral-800"
          }`}
          style={at(mr.lightSwitch)}
        >
          💡
        </button>
      )}

      {hint && (
        <p className="pointer-events-none absolute inset-x-3 top-2 z-[45] rounded-lg bg-black/55 px-3 py-1 text-center font-serif text-sm italic text-amber-50">
          {hint}
        </p>
      )}

      {/* inventory: the key, once taken, stays */}
      {hasKey && (
        <div
          className="pointer-events-none absolute bottom-2 right-2 z-[45] flex items-center gap-1 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-neutral-100"
          role="status"
          aria-label="You have the key"
        >
          <span aria-hidden>🗝️</span> Key
        </div>
      )}

      {/* the vanity card: the order of mom's things */}
      {cardOpen && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full rounded-2xl border-4 border-amber-900 bg-amber-50 p-4 text-amber-950 shadow-2xl">
            <p className="mb-3 text-center font-serif text-base italic">{mr.lines.card}</p>
            <div className="rounded-lg border border-amber-800/35 bg-amber-100 p-3 text-center text-sm leading-relaxed">
              <p className="mb-2 font-serif italic">Mom left clues, not the combination:</p>
              <p>{mr.order.length >= 3
                ? `The ${level.objects.find((o) => o.id === mr.order[1])?.label ?? "middle item"} belongs between the ${level.objects.find((o) => o.id === mr.order[0])?.label ?? "first item"} and the ${level.objects.find((o) => o.id === mr.order[2])?.label ?? "last item"}.`
                : `The ${level.objects.find((o) => o.id === mr.order[0])?.label ?? "first item"} comes before the ${level.objects.find((o) => o.id === mr.order[1])?.label ?? "last item"}.`}</p>
              <p className="mt-2 font-medium">What symbols did you see on them in the dark?</p>
            </div>
            <button
              type="button"
              onClick={() => {
                sfx.click();
                setCardOpen(false);
              }}
              className="mx-auto mt-4 block min-h-12 rounded-xl bg-amber-900 px-6 text-base font-bold text-amber-50 active:scale-95"
            >
              Put it back
            </button>
          </div>
        </div>
      )}

      {/* the drawer's lock: one big button per symbol */}
      {panelOpen && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/70 p-4">
          <div
            className={`w-full rounded-2xl border-4 border-[#3a1f0d] bg-gradient-to-b from-[#8a5a2b] to-[#5a3416] p-4 text-amber-50 shadow-2xl ${rattle === "panel" ? "game-shake" : ""}`}
          >
            <p className="mb-2 text-center font-serif text-base italic">The drawer is locked.</p>
            <div
              className="mb-3 flex justify-center gap-2"
              role="status"
              aria-label={`${input.length} of ${code.length} symbols`}
            >
              {code.map((_, i) => (
                <span
                  key={i}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-amber-200/60 bg-black/40 text-xl"
                  aria-hidden
                >
                  {input[i] ? ASSETS[input[i]].emoji : ""}
                </span>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              {mr.panel.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => press(s)}
                  aria-label={ASSETS[s].label}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-amber-200 bg-amber-100/20 text-3xl active:scale-90"
                >
                  <span aria-hidden>{ASSETS[s].emoji}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                sfx.click();
                setInput([]);
                setPanelOpen(false);
              }}
              className="mx-auto mt-4 block min-h-12 rounded-xl bg-black/50 px-6 text-base font-bold active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* the call from the hallway */}
      {phase === "call" && (
        // kept in the upper part: The Guest's caption band (73–89 %) stays clear
        <div className="absolute inset-0 z-[56] flex flex-col items-center justify-start gap-5 bg-gradient-to-b from-[#0b0806] to-[#1a110a] px-6 pt-[30%] text-center">
          <div
            className="relative h-40 w-24 rounded-t-md border-4 border-[#3a1f0d] bg-[#1a0f08]"
            aria-hidden
          >
            <div className="absolute inset-y-0 right-0 w-[18%] bg-gradient-to-l from-[#ffcf7a]/80 to-[#ffcf7a]/10 shadow-[0_0_30px_8px_rgba(255,200,120,0.35)]" />
          </div>
          {canGo && (
            <button
              type="button"
              onClick={enter}
              className="g-btn g-btn-warm min-h-12 px-6 py-3 text-lg"
            >
              Go to mom's room
            </button>
          )}
        </div>
      )}

      {line && (
        <p
          className={`pointer-events-none absolute left-1/2 top-12 z-[57] w-[90%] -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1 text-center font-serif text-base italic ${
            line.voice ? "game-monster-line text-rose-200" : "text-amber-100"
          }`}
          aria-live="polite"
        >
          {line.voice ? `“${line.text}”` : line.text}
        </p>
      )}
    </div>
  );
}
