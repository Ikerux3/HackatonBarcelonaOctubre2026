import { useCallback, useEffect, useRef, useState } from "react";

import { useGuestVoice } from "@/components/game/GuestVoice";
import { setMusicCorruption, sfx, stopMusicBox } from "@/game/audio";
import { useCameraShake } from "@/game/cameraShake";
import { useCordura100, useCorduraLight } from "@/game/cordura";
import { ASSETS, COLOR_HEX } from "@/game/levels/assets";
import type { MusicBoxOptions } from "@/game/levels/types";
import {
  clearInput,
  glowAt,
  initialMusicBox,
  musicSequence,
  pressNote,
  roundSong,
  type MusicBoxProgress,
} from "@/game/musicBox";
import { SceneBackdrop } from "./SceneBackdrop";
import type { MinigameProps } from "./types";

/** the dark first, then the song: the player sees the room go black before it starts */
const LEAD_MS = 700;
/** The Guest's eyes show up behind the box once the song has played through once */
const EYES_AFTER_LOOPS = 1;

/**
 * music_box (Minigame 03, Drive D41): The Guest wound up the music box and the child wants
 * it to stop. With the light OFF its symbols glow in order (the song); with the light ON
 * the player taps them back. Four rounds (3, 4, 5, 7), each kept once done; a wrong symbol
 * only clears the round being typed. Then the key turns and the music stops.
 * Sound is optional: every symbol has its own shape, color and label.
 */
export function MusicBoxMinigame({ level, onComplete }: MinigameProps) {
  const mb = (level.type === "music_box" ? level.musicBox : null) as MusicBoxOptions | null;
  const box = level.targets[0]!;
  const rounds = mb?.rounds ?? [];
  const [song] = useState(() =>
    musicSequence(
      level.objects.map((o) => o.id),
      Math.max(0, ...rounds),
      mb?.sequence ?? null,
    ),
  );
  const { shakeClass, shake: camShake, raiseTension } = useCameraShake();

  const [light, setLight] = useState(true);
  const [initialFlicker, setInitialFlicker] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setInitialFlicker(false), 1100);
    return () => clearTimeout(t);
  }, []);
  const [progress, setProgress] = useState<MusicBoxProgress>(initialMusicBox);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [glow, setGlow] = useState<string | null>(null);
  const [eyes, setEyes] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [turns, setTurns] = useState(0);
  const [done, setDone] = useState(false);
  /** the switch pulses until the player has tried the dark once */
  const [triedDark, setTriedDark] = useState(false);

  const [whisper, setWhisper] = useState<string | null>(null);
  useGuestVoice(whisper);
  const whisperT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((line: string, ms = 3200) => {
    if (!line) return;
    if (whisperT.current) clearTimeout(whisperT.current);
    setWhisper(line);
    whisperT.current = setTimeout(() => setWhisper(null), ms);
  }, []);
  useEffect(() => {
    if (mb) say(mb.lines.start, 4200);
    return () => {
      if (whisperT.current) clearTimeout(whisperT.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allRounds = progress.round >= rounds.length;
  const current = roundSong(song, rounds, progress.round);

  // Cordura: the room light is the only light here
  useCorduraLight(done ? null : light ? "lit" : "dark");
  // D44: the bar hit 100 → only the round being typed is lost; the light comes back on
  useCordura100(() => {
    if (done) return;
    setProgress(clearInput);
    setLight(true);
  });

  // The tune goes subtly wrong in the dark, then sounds familiar once lit.
  useEffect(() => {
    setMusicCorruption(light ? 1 : 3);
    if (!light && progress.round === 3 && !done) sfx.knock();
  }, [light, progress.round, done]);

  // in the dark the song plays on the box, over and over, while rounds are left
  useEffect(() => {
    if (!mb || light || allRounds || done) {
      setGlow(null);
      setEyes(false);
      return;
    }
    const startedAt = Date.now();
    let lastStep: string | null = null;
    const timing = { showMs: mb.showMs, gapMs: mb.gapMs, loopPauseMs: mb.loopPauseMs };
    const iv = setInterval(() => {
      const g = glowAt(Date.now() - startedAt, current, { ...timing, leadMs: LEAD_MS });
      if (g.step && g.step !== lastStep) sfx.click();
      lastStep = g.step;
      setGlow(g.id);
      if (g.loops >= EYES_AFTER_LOOPS) setEyes(true);
    }, 40);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light, progress.round, allRounds, done]);

  const toggleLight = () => {
    if (done) return;
    sfx.lightSwitch();
    if (light) {
      setTriedDark(true);
      // watching the song again means typing this round from the start
      setProgress(clearInput);
    }
    setLight((v) => !v);
  };

  const press = (id: string) => {
    if (!mb || done || allRounds || !light) return;
    const { progress: next, result } = pressNote(progressRef.current, id, song, rounds);
    progressRef.current = next;
    setProgress(next);
    setPressed(id);
    setTimeout(() => setPressed((p) => (p === id ? null : p)), 260);
    if (result === "ok") sfx.snap();
    else if (result === "wrong") {
      sfx.wrong();
      setWrong(id);
      setTimeout(() => setWrong(null), 450);
      say(mb.lines.wrong);
    } else if (result === "round") {
      sfx.success();
      camShake(1);
      raiseTension(1);
      say(mb.lines.round);
    } else if (result === "song") {
      sfx.success();
      camShake(2);
      raiseTension(1);
      say(mb.lines.key, 4200);
    }
  };

  const turnKey = () => {
    if (!mb || done || !allRounds || !light) return;
    sfx.click();
    const n = turns + 1;
    setTurns(n);
    if (n < mb.keyTurns) return;
    setDone(true);
    stopMusicBox();
    say(mb.lines.done, 3000);
    onComplete?.();
  };

  if (!mb) return null;

  const hint = done ? "" : allRounds ? mb.hints.key : light ? mb.hints.lit : mb.hints.dark;
  const glowObj = level.objects.find((o) => o.id === glow);

  return (
    <div
      className={`g-stage relative w-full touch-none select-none overflow-hidden rounded-2xl border border-neutral-800 ${shakeClass} ${initialFlicker ? "game-flicker" : ""}`}
      style={{ aspectRatio: "2 / 3" }}
      role="application"
      aria-label="The music box. Turn the light off to see its song, on to play it back."
    >
      <SceneBackdrop theme={level.theme} dark={false} />

      {hint && (
        <p className="pointer-events-none absolute inset-x-3 top-2 z-[45] rounded-lg bg-black/55 px-3 py-1 text-center font-serif text-sm italic text-amber-50">
          {hint}
        </p>
      )}

      {/* the music box: open lid, a tiny dancer that turns while it plays */}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: `${box.x - box.w / 2}%`,
          top: `${box.y - box.h / 2}%`,
          width: `${box.w}%`,
          height: `${box.h}%`,
        }}
        aria-hidden
      >
        <div className="absolute inset-x-[6%] -top-[38%] h-[42%] origin-bottom -skew-x-6 rounded-t-xl border-4 border-amber-950 bg-gradient-to-b from-rose-900 to-amber-900 shadow-inner" />
        <div className="absolute inset-0 rounded-xl border-4 border-amber-950 bg-gradient-to-b from-amber-700 to-amber-900 shadow-[0_10px_24px_rgba(0,0,0,0.55)]" />
        <span
          className={`absolute left-1/2 -top-[30%] -translate-x-1/2 text-2xl ${done ? "" : "animate-spin [animation-duration:3s] motion-reduce:animate-none"}`}
        >
          💃
        </span>
        {!done && light && (
          <span className="absolute -right-2 -top-[34%] text-lg text-amber-900/80 motion-safe:animate-bounce">
            ♫
          </span>
        )}
      </div>

      {/* Rounds 3/4: a silhouette in the window, and a knock only on round 4. */}
      {!light && progress.round >= 2 && !allRounds && (
        <div aria-hidden className="pointer-events-none absolute left-[7%] top-[24%] z-[20] flex h-20 w-10 items-center justify-center rounded-t-2xl border border-slate-500/40 bg-black/70 text-3xl text-slate-300/80">
          👤
        </div>
      )}

      {/* The Guest, behind the box, once the song has played through */}
      {eyes && !light && (
        <div
          className="pointer-events-none absolute left-1/2 z-[35] flex -translate-x-1/2 gap-6"
          style={{ top: `${Math.max(4, box.y - box.h / 2 - 22)}%` }}
          aria-hidden
        >
          <span className="h-2.5 w-5 animate-pulse rounded-full bg-red-600 shadow-[0_0_14px_4px_var(--color-red-600)]" />
          <span className="h-2.5 w-5 animate-pulse rounded-full bg-red-600 shadow-[0_0_14px_4px_var(--color-red-600)]" />
        </div>
      )}

      {/* darkness: the symbols stay above it, faint, and glow when the song reaches them */}
      {!light && <div className="pointer-events-none absolute inset-0 z-30 bg-black/85" />}

      {level.objects.map((o) => {
        const lit = glow === o.id;
        const hex = COLOR_HEX[o.color];
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => press(o.id)}
            aria-label={o.label}
            aria-disabled={!light || allRounds || done}
            className={`absolute z-40 flex flex-col items-center justify-center rounded-full border-4 transition-[transform,opacity,box-shadow] duration-150 ${
              wrong === o.id ? "game-shake" : ""
            } ${pressed === o.id ? "scale-90" : ""}`}
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              width: `${o.size}%`,
              aspectRatio: "1",
              transform: `translate(-50%, -50%) ${lit ? "scale(1.18)" : ""}`,
              borderColor: light || lit ? hex : "#3a3a3a",
              backgroundColor: light ? `${hex}33` : lit ? `${hex}66` : "#111",
              opacity: light ? 1 : lit ? 1 : 0.28,
              boxShadow: lit
                ? `0 0 28px 10px ${hex}`
                : pressed === o.id
                  ? `0 0 16px 4px ${hex}`
                  : "0 4px 10px rgba(0,0,0,0.45)",
            }}
          >
            <span className="text-3xl leading-none" aria-hidden>
              {ASSETS[o.asset].emoji}
            </span>
          </button>
        );
      })}

      {/* screen readers hear each symbol as it glows */}
      <p className="sr-only" aria-live="polite">
        {glowObj ? glowObj.label : ""}
      </p>

      {/* the winding key: only turns once every round is done, with the light on */}
      <button
        type="button"
        onClick={turnKey}
        aria-label={
          allRounds ? `Turn the key (${turns}/${mb.keyTurns})` : "The key — it won't turn yet"
        }
        aria-disabled={!allRounds || !light || done}
        className={`absolute z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-2xl transition-transform duration-300 ${
          allRounds && !done
            ? "border-amber-200 bg-amber-300/90 ring-4 ring-amber-400 motion-safe:animate-pulse"
            : "border-amber-950/40 bg-amber-900/40 opacity-60"
        }`}
        style={{
          left: `${mb.key.x}%`,
          top: `${mb.key.y}%`,
          rotate: `${(turns * 360) / Math.max(1, mb.keyTurns)}deg`,
        }}
      >
        🗝️
      </button>

      <button
        type="button"
        onClick={toggleLight}
        aria-label={light ? "Turn the light off" : "Turn the light on"}
        aria-pressed={light}
        className={`absolute z-[45] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 text-xl ${
          light
            ? `border-amber-200 bg-amber-300/90 ${triedDark || done ? "" : "animate-pulse ring-4 ring-amber-400"}`
            : "animate-pulse border-amber-200 bg-neutral-800"
        }`}
        style={{ left: `${mb.lightSwitch.x}%`, top: `${mb.lightSwitch.y}%` }}
      >
        💡
      </button>

      {/* progress: one note per round (kept), and the symbols typed in this one */}
      <div
        className="pointer-events-none absolute bottom-2 left-1/2 z-[45] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-neutral-100"
        aria-label={`Round ${Math.min(progress.round + 1, rounds.length)} of ${rounds.length}${
          allRounds ? ", all done" : `, ${progress.input.length} of ${current.length} symbols`
        }`}
        role="status"
      >
        <span className="flex gap-0.5" aria-hidden>
          {rounds.map((_, i) => (
            <span key={i} className={i < progress.round ? "text-amber-300" : "opacity-30"}>
              ♪
            </span>
          ))}
        </span>
        {!allRounds && (
          <span className="flex gap-1" aria-hidden>
            {current.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i < progress.input.length ? "bg-amber-300" : "bg-neutral-500"}`}
              />
            ))}
          </span>
        )}
      </div>

      {whisper && (
        <p className="game-monster-line pointer-events-none absolute left-1/2 top-10 z-50 w-[90%] -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1 text-center font-serif text-base italic text-red-300">
          {whisper}
        </p>
      )}
    </div>
  );
}
