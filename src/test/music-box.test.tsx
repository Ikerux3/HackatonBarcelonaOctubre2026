import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestVoiceProvider } from "@/components/game/GuestVoice";
import { MusicBoxMinigame } from "@/components/minigames/MusicBoxMinigame";
import { CorduraContext, type CorduraLight, type CorduraReporter } from "@/game/cordura";
import { gameReducer, initialGameState, type GameAction, type GameState } from "@/game/GameState";
import { levelById, STORY_LEVELS } from "@/game/levels/defaultLevels";
import type { MusicBoxLevel } from "@/game/levels/types";
import { validateLevel } from "@/game/levels/validate";
import {
  clearInput,
  glowAt,
  initialMusicBox,
  musicSequence,
  pressNote,
  roundSong,
  type MusicBoxProgress,
} from "@/game/musicBox";

const SONG = ["moon", "star", "bell", "heart", "moon", "star", "bell"];
const ROUNDS = [3, 4, 5, 7];
const template = levelById("music_box") as MusicBoxLevel;
const fixed: MusicBoxLevel = { ...template, musicBox: { ...template.musicBox, sequence: SONG } };

/** types every symbol of the current round, correctly */
function playRound(p: MusicBoxProgress) {
  let r = { progress: p, result: "ignored" as ReturnType<typeof pressNote>["result"] };
  for (const id of roundSong(SONG, ROUNDS, p.round)) r = pressNote(r.progress, id, SONG, ROUNDS);
  return r;
}

describe("music box rules (Drive D41)", () => {
  it("four rounds of 3, 4, 5 and 7 symbols, each starting with the previous song", () => {
    expect(template.musicBox.rounds).toEqual(ROUNDS);
    expect(ROUNDS.map((_, i) => roundSong(SONG, ROUNDS, i))).toEqual([
      SONG.slice(0, 3),
      SONG.slice(0, 4),
      SONG.slice(0, 5),
      SONG,
    ]);
    let r = playRound(initialMusicBox);
    expect(r).toEqual({ progress: { round: 1, input: [] }, result: "round" });
    r = playRound(r.progress);
    r = playRound(r.progress);
    expect(r.progress.round).toBe(3);
    r = playRound(r.progress);
    expect(r).toEqual({ progress: { round: 4, input: [] }, result: "song" });
    // once the song is done, taps do nothing
    expect(pressNote(r.progress, "moon", SONG, ROUNDS).result).toBe("ignored");
  });

  it("a wrong symbol only clears the round being typed — earlier rounds are kept", () => {
    const atRound2 = playRound(playRound(initialMusicBox).progress).progress;
    expect(atRound2.round).toBe(2);
    let p = pressNote(atRound2, "moon", SONG, ROUNDS).progress;
    p = pressNote(p, "star", SONG, ROUNDS).progress;
    expect(p).toEqual({ round: 2, input: ["moon", "star"] });
    const wrong = pressNote(p, "heart", SONG, ROUNDS);
    expect(wrong).toEqual({ progress: { round: 2, input: [] }, result: "wrong" });
    // turning the light off to watch again / the Cordura 100 event: same, round kept
    expect(clearInput(p)).toEqual({ round: 2, input: [] });
    expect(clearInput(atRound2)).toBe(atRound2);
  });

  it("random songs have the right length, use only the symbols and never repeat three alike", () => {
    const ids = ["moon", "star", "bell", "heart"];
    expect(musicSequence(ids, 7, SONG)).toEqual(SONG);
    for (let run = 0; run < 200; run++) {
      const song = musicSequence(ids, 7, null);
      expect(song).toHaveLength(7);
      expect(song.every((s) => ids.includes(s))).toBe(true);
      expect(song.some((s, i) => i >= 2 && s === song[i - 1] && s === song[i - 2])).toBe(false);
    }
  });

  it("in the dark each symbol glows in turn and the song loops", () => {
    const t = { showMs: 600, gapMs: 300, loopPauseMs: 1000, leadMs: 500 };
    const song = SONG.slice(0, 3);
    expect(glowAt(400, song, t).id).toBeNull(); // the dark first
    expect(glowAt(600, song, t).id).toBe("moon");
    expect(glowAt(1200, song, t).id).toBeNull(); // the gap
    expect(glowAt(1450, song, t).id).toBe("star");
    expect(glowAt(2300, song, t).id).toBe("bell");
    // 3 × 900 + 1000 = 3700 ms per loop: then it starts again
    const again = glowAt(500 + 3700 + 100, song, t);
    expect(again).toEqual({ id: "moon", step: "1:0", loops: 1 });
  });

  it("the level file is valid and the validator catches broken music boxes", () => {
    expect(validateLevel(template).ok).toBe(true);
    expect(STORY_LEVELS.task_music.id).toBe("music_box");
    const broken = (patch: Partial<MusicBoxLevel["musicBox"]>, objects = template.objects) =>
      validateLevel({ ...template, objects, musicBox: { ...template.musicBox, ...patch } });
    expect(broken({}, template.objects.slice(0, 2)).ok).toBe(false);
    expect(broken({ rounds: [3, 5, 4] }).ok).toBe(false);
    expect(broken({ rounds: [] }).ok).toBe(false);
    expect(broken({ sequence: ["moon", "star"] }).ok).toBe(false);
    expect(broken({ sequence: [...SONG.slice(0, 6), "ghost"] }).ok).toBe(false);
    expect(broken({ keyTurns: 0 }).ok).toBe(false);
    expect(broken({ showMs: 50 }).ok).toBe(false);
    expect(broken({ sequence: SONG }).ok).toBe(true);
  });
});

describe("music box minigame (UI)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        cancel: vi.fn(),
        getVoices: () => [],
        removeEventListener: vi.fn(),
        speak: vi.fn(),
      },
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function setup() {
    const lights: (CorduraLight | null)[] = [];
    const handlers = new Set<() => void>();
    const reporter: CorduraReporter = {
      light: (l) => {
        lights.push(l);
      },
      fullScare: () => {},
      onEvent100: (h) => {
        handlers.add(h);
        return () => handlers.delete(h);
      },
    };
    const onComplete = vi.fn();
    render(
      <GuestVoiceProvider>
        <CorduraContext.Provider value={reporter}>
          <MusicBoxMinigame level={fixed} memory={{}} dark onComplete={onComplete} />
        </CorduraContext.Provider>
      </GuestVoiceProvider>,
    );
    const tap = (name: string) =>
      act(() => void fireEvent.click(screen.getByRole("button", { name })));
    const status = () => screen.getByRole("status").getAttribute("aria-label");
    return { lights, handlers, onComplete, tap, status };
  }
  const label = { moon: "Moon", star: "Star", bell: "Bell", heart: "Heart" } as Record<
    string,
    string
  >;

  it("the song only shows in the dark, only types with the light on, and the key ends it", () => {
    const { lights, onComplete, tap, status } = setup();
    expect(status()).toBe("Round 1 of 4, 0 of 3 symbols");
    expect(lights.at(-1)).toBe("lit");

    // light off: the first symbol glows (screen readers hear it); taps do nothing
    tap("Turn the light off");
    expect(lights.at(-1)).toBe("dark");
    act(() => void vi.advanceTimersByTime(800));
    expect(screen.getByText("Moon")).toBeTruthy();
    tap("Moon");
    expect(status()).toBe("Round 1 of 4, 0 of 3 symbols");

    // light on: type it back; every round is kept
    tap("Turn the light on");
    expect(screen.queryByText("Moon")).toBeNull();
    for (const len of ROUNDS) {
      for (const id of SONG.slice(0, len)) tap(label[id]!);
    }
    expect(status()).toBe("Round 4 of 4, all done");
    expect(onComplete).not.toHaveBeenCalled();

    // the key: three turns with the light on
    tap("Turn the key (0/3)");
    tap("Turn the key (1/3)");
    tap("Turn the key (2/3)");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(lights.at(-1)).toBeNull(); // done: Cordura stops counting
  });

  it("a wrong symbol, the light going off or the 100 event only reset the current round", () => {
    const { handlers, tap, status } = setup();
    for (const id of SONG.slice(0, 3)) tap(label[id]!);
    expect(status()).toBe("Round 2 of 4, 0 of 4 symbols");
    tap("Moon");
    tap("Heart"); // wrong (the song goes moon, star…)
    expect(status()).toBe("Round 2 of 4, 0 of 4 symbols");
    tap("Moon");
    tap("Star");
    tap("Turn the light off"); // watching again → retype this round
    tap("Turn the light on");
    expect(status()).toBe("Round 2 of 4, 0 of 4 symbols");
    tap("Moon");
    tap("Turn the light off");
    act(() => handlers.forEach((h) => h())); // the bar hit 100
    expect(screen.getByRole("button", { name: "Turn the light off" })).toBeTruthy();
    expect(status()).toBe("Round 2 of 4, 0 of 4 symbols");
    // the key won't turn before the song is done
    tap("The key — it won't turn yet");
    expect(status()).toBe("Round 2 of 4, 0 of 4 symbols");
  });
});

describe("story order with the music box", () => {
  const run = (s: GameState, ...a: GameAction[]) => a.reduce(gameReducer, s);
  it("toys → table → music box → bedtime, with its own blackout and no question", () => {
    const afterToy = run(
      initialGameState,
      { type: "START" },
      { type: "SET_NAME", name: "Unai" },
      { type: "ADVANCE" },
      { type: "TASK_DONE" },
      { type: "ADVANCE" },
      { type: "AI_RESULT", monsterLine: "…", normalizedColor: "blue" },
      { type: "ADVANCE" },
      { type: "TASK_DONE" },
      { type: "ADVANCE" },
      { type: "AI_RESULT", monsterLine: "…", normalizedToy: "teddy" },
      { type: "ADVANCE" },
    );
    expect(afterToy.stage).toBe("task_music");
    // Cordura counts in the music box, and leaving it doesn't freeze the bar yet
    let s = run(afterToy, { type: "CORDURA_TICK", light: "dark", ms: 2000 });
    expect(s.cordura.value).toBe(1);
    s = run(s, { type: "TASK_DONE" });
    expect(s.stage).toBe("blackout_music");
    expect(s.cordura.final).toBeNull();
    s = run(s, { type: "ADVANCE" });
    expect(s.stage).toBe("task_three");
    expect(run(s, { type: "TASK_DONE" }).cordura.final).toBe(1);
  });
});
