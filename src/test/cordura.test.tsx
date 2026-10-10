import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CORDURA_RULES, corduraEnding, finalCordura, freezeFinalCordura,
  initialCordura, resetCorduraAtCheckpoint, scareCordura, tickCordura,
} from "@/game/cordura";
import { useGameController } from "@/game/GameController";
import {
  gameReducer, initialGameState, type GameAction, type GameState,
} from "@/game/GameState";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const run = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

function atLastTask(cordura?: number): GameState {
  const s = run(
    initialGameState,
    { type: "START", motherColor: "purple", ...(cordura === undefined ? {} : { cordura }) },
    { type: "SET_NAME", name: "Lucia" },
    { type: "ADVANCE" },
    { type: "TASK_DONE" }, { type: "ADVANCE" },
    { type: "AI_RESULT", monsterLine: "…", normalizedColor: "blue" },
    { type: "ADVANCE" },
    { type: "TASK_DONE" }, { type: "ADVANCE" },
    { type: "AI_RESULT", monsterLine: "…", normalizedToy: "teddy" },
    { type: "ADVANCE" },
    { type: "TASK_DONE" }, { type: "ADVANCE" },
    { type: "TASK_DONE" }, { type: "ADVANCE" },
  );
  expect(s.stage).toBe("task_three");
  return s;
}

describe("MJ v3.1 - Cordura pressure, checkpoint and six-second ending", () => {
  it("starts at zero with a light on, and darkness rises +3 points EACH second", () => {
    expect(initialCordura.value).toBe(0);
    expect(CORDURA_RULES.darkMsPerPoint).toBe(1000);
    expect(CORDURA_RULES.darkPointsPerInterval).toBe(3);
    expect(tickCordura(initialCordura, "lit", 100_000).value).toBe(0);
    expect(tickCordura(initialCordura, "dark", 999).value).toBe(0);
    const part = tickCordura(initialCordura, "dark", 1500);
    expect(part.value).toBe(3);
    expect(tickCordura(part, "dark", 500).value).toBe(6);
    expect(tickCordura(initialCordura, "dark", 10_000).value).toBe(30);
  });

  it("light recovers only one point per two seconds, to floor zero", () => {
    expect(CORDURA_RULES.litMsPerPoint).toBe(2000);
    const harmed = tickCordura(initialCordura, "dark", 5_000);
    expect(harmed.value).toBe(15);
    expect(tickCordura(harmed, "lit", 1999).value).toBe(15);
    const recovery = tickCordura(harmed, "lit", 4000);
    expect(recovery.value).toBe(13);
    const safe = tickCordura(recovery, "lit", 999_999);
    expect(safe.value).toBe(0);
    expect(tickCordura(safe, "dark", 1000).value).toBe(3);
  });

  it("a real monster scare adds 10; even reaching 100 stays capped", () => {
    expect(CORDURA_RULES.fullScare).toBe(10);
    expect(scareCordura(initialCordura).value).toBe(10);
    const top = scareCordura({ ...initialCordura, value: 95 });
    expect(top.value).toBe(100);
    expect(top.events100).toBe(1);
    expect(tickCordura(top, "dark", 10_000).events100).toBe(1);
  });

  it("100% restarts only the current minigame at 50 and keeps prior memories", () => {
    const first = run(initialGameState,
      { type: "START", motherColor: "pink" },
      { type: "SET_NAME", name: "Lucia" },
      { type: "ADVANCE" },
      { type: "CORDURA_TICK", light: "dark", ms: 34_000 },
    );
    expect(first.cordura.value).toBe(100);
    expect(first.cordura.events100).toBe(1);
    const again = gameReducer(first, { type: "CORDURA_RESET_100" });
    expect(again.stage).toBe("task_one");
    expect(again.cordura.value).toBe(50);
    expect(again.resetSerial).toBe(1);
    expect(again.memory.playerName).toBe("Lucia");
    expect(again.memory.motherColor).toBe("pink");
    expect(again.cordura.armed100).toBe(true);
    expect(gameReducer(again, { type: "CORDURA_TICK", light: "dark", ms: 17_000 }).cordura.events100).toBe(2);
  });

  it("checkpoint helper preserves event history but resets partial seconds", () => {
    const prior = tickCordura(initialCordura, "dark", 34_000);
    const restarted = resetCorduraAtCheckpoint(prior);
    expect(restarted.value).toBe(50);
    expect(restarted.darkMs).toBe(0);
    expect(restarted.litMs).toBe(0);
    expect(restarted.events100).toBe(1);
  });

  it("no accidental Cordura ticks or jump scares in questions and other cutscenes", () => {
    const blackout = run(initialGameState,
      { type: "START" }, { type: "SET_NAME", name: "Lucia" },
      { type: "ADVANCE" }, { type: "TASK_DONE" });
    expect(blackout.stage).toBe("blackout_one");
    const notHarmed = run(blackout,
      { type: "CORDURA_TICK", light: "dark", ms: 10_000 },
      { type: "FULL_SCARE" });
    expect(notHarmed.cordura.value).toBe(0);
  });

  it("final darkness adds exactly +5 ONCE, and never restarts at 100", () => {
    const s = gameReducer(atLastTask(95), { type: "TASK_DONE" });
    expect(s.stage).toBe("blackout_three");
    expect(s.cordura.value).toBe(100);
    expect(s.cordura.final).toBe(100);
    expect(s.cordura.events100).toBe(0);
    const again = gameReducer(s, { type: "TASK_DONE" });
    expect(again.cordura.final).toBe(100);
    const next = run(s, { type: "CORDURA_TICK", light: "dark", ms: 6000 }, { type: "ADVANCE" });
    expect(next.stage).toBe("goodnight_whisper");
    expect(next.cordura.value).toBe(100);
    expect(next.resetSerial).toBe(0);
  });

  it("final threshold uses the AFTER +5 snapshot: 59 good, 60 crying", () => {
    const a = gameReducer(atLastTask(59), { type: "TASK_DONE" });
    const b = gameReducer(atLastTask(60), { type: "TASK_DONE" });
    expect(finalCordura(a.cordura)).toBe(64);
    expect(finalCordura(b.cordura)).toBe(65);
    expect(corduraEnding(finalCordura(a.cordura))).toBe("scared");
    expect(corduraEnding(finalCordura(b.cordura))).toBe("crying");
    expect(freezeFinalCordura({ ...initialCordura, value: 99 }).final).toBe(100);
  });

  it("controller handles event100 by remounting the active minigame at 50", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGameController());
    act(() => result.current.start(["red"], 99));
    act(() => result.current.setName("Lucia"));
    act(() => result.current.advance());
    expect(result.current.state.stage).toBe("task_one");
    act(() => result.current.cordura.light("dark"));
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.state.resetSerial).toBe(1);
    expect(result.current.state.cordura.value).toBe(50);
    expect(result.current.state.stage).toBe("task_one");
  });
});
