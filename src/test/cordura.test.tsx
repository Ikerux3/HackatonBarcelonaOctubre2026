import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EndingScreen } from "@/components/game/EndingScreen";
import { EndingSequence } from "@/components/game/EndingSequence";
import { GuestVoiceProvider } from "@/components/game/GuestVoice";
import {
  CORDURA_RULES,
  corduraEnding,
  finalCordura,
  freezeCordura,
  initialCordura,
  scareCordura,
  tickCordura,
} from "@/game/cordura";
import { gameReducer, initialGameState, type GameAction, type GameState } from "@/game/GameState";

afterEach(cleanup);

// The ending scenes speak The Guest's lines (Flash's GuestVoice): they need the provider
// GameShell gives them, and jsdom has no speech synthesis, so stub a silent one.
beforeEach(() => {
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
const inShell = (ui: ReactNode) => render(<GuestVoiceProvider>{ui}</GuestVoiceProvider>);

const run = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

/** time in the light or the dark, in the controller's 500 ms ticks */
function spend(s: GameState, light: "lit" | "dark", ms: number): GameState {
  for (let left = ms; left > 0; left -= 500)
    s = gameReducer(s, { type: "CORDURA_TICK", light, ms: Math.min(500, left) });
  return s;
}
const scares = (s: GameState, n: number) =>
  run(s, ...Array.from({ length: n }, (): GameAction => ({ type: "FULL_SCARE" })));

/** a run that has reached the last minigame */
function atLastTask(): GameState {
  const s = run(
    initialGameState,
    { type: "START", motherColor: "purple" },
    { type: "SET_NAME", name: "Unai" },
    { type: "ADVANCE" }, // → task_one
    { type: "TASK_DONE" },
    { type: "ADVANCE" }, // → question_one
    { type: "AI_RESULT", monsterLine: "…", normalizedColor: "blue" },
    { type: "ADVANCE" }, // → task_two
    { type: "TASK_DONE" },
    { type: "ADVANCE" }, // → question_two
    { type: "AI_RESULT", monsterLine: "…", normalizedToy: "teddy" },
    { type: "ADVANCE" }, // → task_three
  );
  expect(s.stage).toBe("task_three");
  expect(s.cordura.value).toBe(0);
  return s;
}

describe("Barra de Cordura (Drive D28/D33/D34)", () => {
  it("+1 every 2 s in the dark — never per second — and partial seconds add up", () => {
    expect(tickCordura(initialCordura, "dark", 1999).value).toBe(0);
    expect(tickCordura(tickCordura(initialCordura, "dark", 1999), "dark", 1).value).toBe(1);
    expect(spend(atLastTask(), "dark", 10_000).cordura.value).toBe(5);
    // 1.5 s dark, a moment of light, 0.5 s dark again: still one point
    const s = spend(spend(spend(atLastTask(), "dark", 1500), "lit", 500), "dark", 500);
    expect(s.cordura.value).toBe(1);
  });

  it("the light brings it down at the configured rate, never below zero and with no credit", () => {
    let s = scares(atLastTask(), 1);
    expect(s.cordura.value).toBe(10);
    s = spend(s, "lit", CORDURA_RULES.litMsPerPoint * 4);
    expect(s.cordura.value).toBe(6);
    s = spend(s, "lit", 60_000);
    expect(s.cordura.value).toBe(0);
    // a long time in the light doesn't protect against the next darkness
    expect(spend(s, "dark", CORDURA_RULES.darkMsPerPoint).cordura.value).toBe(1);
  });

  it("a full scare adds 10 and the bar is capped at 100", () => {
    let s = scares(atLastTask(), 12);
    expect(s.cordura.value).toBe(100);
    s = spend(s, "dark", 20_000);
    expect(s.cordura.value).toBe(100);
    expect(spend(s, "lit", CORDURA_RULES.litMsPerPoint).cordura.value).toBe(99);
  });

  it("does not move during questions or blackouts", () => {
    const s = run(
      initialGameState,
      { type: "START" },
      { type: "SET_NAME", name: "Unai" },
      { type: "ADVANCE" },
      { type: "TASK_DONE" },
    );
    expect(s.stage).toBe("blackout_one");
    expect(scares(spend(s, "dark", 10_000), 2).cordura).toEqual(initialCordura);
    const q = gameReducer(s, { type: "ADVANCE" });
    expect(q.stage).toBe("question_one");
    expect(scares(spend(q, "dark", 10_000), 2).cordura).toEqual(initialCordura);
  });

  it("ending threshold: 64 → a little scared, 65 → crying", () => {
    expect(corduraEnding(0)).toBe("scared");
    expect(corduraEnding(64)).toBe("scared");
    expect(corduraEnding(65)).toBe("crying");
    expect(corduraEnding(100)).toBe("crying");
    // 6 scares + 8 s / 10 s in the dark, then leaving the last minigame
    const at64 = gameReducer(spend(scares(atLastTask(), 6), "dark", 8000), { type: "TASK_DONE" });
    const at65 = gameReducer(spend(scares(atLastTask(), 6), "dark", 10_000), { type: "TASK_DONE" });
    expect(finalCordura(at64.cordura)).toBe(64);
    expect(corduraEnding(finalCordura(at64.cordura))).toBe("scared");
    expect(finalCordura(at65.cordura)).toBe(65);
    expect(corduraEnding(finalCordura(at65.cordura))).toBe("crying");
  });

  it("uses the value when the last minigame ends, not the highest reached (70 → 40)", () => {
    let s = scares(atLastTask(), 7);
    expect(s.cordura.value).toBe(70);
    s = spend(s, "lit", CORDURA_RULES.litMsPerPoint * 30);
    expect(s.cordura.value).toBe(40);
    s = gameReducer(s, { type: "TASK_DONE" });
    expect(s.cordura.final).toBe(40);
    expect(corduraEnding(finalCordura(s.cordura))).toBe("scared");
  });

  it("is frozen from the last minigame on: the final blackout and mom's return change nothing", () => {
    let s = gameReducer(spend(atLastTask(), "dark", 20_000), { type: "TASK_DONE" });
    expect(s.stage).toBe("blackout_three");
    expect(s.cordura.final).toBe(10);
    for (const stage of ["goodnight_whisper", "mom_returns", "unsettling_detail", "ending"]) {
      s = scares(spend(gameReducer(s, { type: "ADVANCE" }), "dark", 10_000), 3);
      expect(s.stage).toBe(stage);
      expect(finalCordura(s.cordura)).toBe(10);
    }
    // frozen even if a late report slipped through
    const frozen = freezeCordura({ ...initialCordura, value: 30 });
    expect(scareCordura(tickCordura(frozen, "dark", 60_000))).toEqual(frozen);
    // a new run starts at zero
    expect(gameReducer(s, { type: "REPLAY" }).cordura).toEqual(initialCordura);
  });

  it("the ending scenes follow the frozen value", () => {
    const memory = { motherColor: "purple" as const, favoriteToy: "teddy" as const };
    const props = {
      name: "Unai",
      memory,
      toyText: "your teddy",
      colorText: "blue",
      onSkip: () => {},
    };
    inShell(<EndingSequence stage="mom_returns" ending="crying" {...props} />);
    expect(screen.getByText(/you're crying/)).toBeTruthy();
    cleanup();
    inShell(<EndingSequence stage="mom_returns" ending="scared" {...props} />);
    expect(screen.getByText(/Did you tidy up\?/)).toBeTruthy();
    cleanup();
    inShell(<EndingSequence stage="unsettling_detail" ending="crying" {...props} />);
    // the drawing is aria-hidden (the button's label describes the scene)
    expect(screen.getByRole("img", { name: "The child, crying", hidden: true })).toBeTruthy();
    expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/while you cry/);
    cleanup();
    render(
      <EndingScreen
        lastedMs={0}
        colorText="blue"
        toyText="your teddy"
        noticed={[]}
        cordura={72}
        onReplay={() => {}}
      />,
    );
    expect(screen.getByText(/Mom found you crying\./)).toBeTruthy();
  });
});
