import { useCallback, useEffect, useReducer, useRef } from "react";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import type { GuestRequest, QuestionType } from "@/ai/contracts";
import { decideGuest } from "@/ai/guestAdapter";
import { ruleGuestDecision } from "@/ai/guestFacts";
import {
  gameReducer,
  guestNotes,
  initialGameState,
  type GameStage,
  type GameState,
  type GuestSlot,
} from "./GameState";
import { initAudio, sfx } from "./audio";
import { allowedGuestActions } from "./guestEffects";
import type { LevelConfig } from "./levels/types";
import { loadGuestMemory, observe } from "./observer";

/** Everything The Guest may know: observations, validated answers, last run on this device. */
function buildGuestRequest(s: GameState, level: LevelConfig): GuestRequest {
  const prev = loadGuestMemory();
  return {
    allowedActions: allowedGuestActions(level),
    observations: observe.snapshot(),
    memory: {
      ...(s.memory.favoriteColor ? { favoriteColor: s.memory.favoriteColor } : {}),
      ...(s.memory.favoriteToy ? { favoriteToy: s.memory.favoriteToy } : {}),
      ...(prev.lastColor ? { lastRunColor: prev.lastColor } : {}),
      ...(prev.lastToy ? { lastRunToy: prev.lastToy } : {}),
    },
    alreadyNoticed: guestNotes(s),
  };
}

/** how long a blackout lingers before the question appears */
export const BLACKOUT_MS = 3200;

/** auto-advance timings for the timed stages (ms) */
const TIMED_STAGES: Partial<Record<GameStage, number>> = {
  intro_leave: 8200, // typing + door; tap also continues
  blackout_one: BLACKOUT_MS,
  blackout_two: BLACKOUT_MS,
  blackout_three: BLACKOUT_MS,
  goodnight_whisper: 5200,
  mom_returns: 4800,
  unsettling_detail: 6500, // goodbye line types out; tap also continues
};

export function useGameController() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const start = useCallback(() => {
    initAudio();
    sfx.click();
    observe.reset();
    dispatch({ type: "START" });
  }, []);

  /** During a blackout: ask The Guest (real model) what it does in the next task. */
  const requestGuest = useCallback((slot: GuestSlot, level: LevelConfig) => {
    void decideGuest(buildGuestRequest(stateRef.current, level)).then((decision) =>
      dispatch({ type: "GUEST_DECISION", slot, decision }),
    );
  }, []);

  /** At task start: if the model hasn't answered yet, decide with the rules now. */
  const ensureGuest = useCallback((slot: GuestSlot, level: LevelConfig) => {
    if (stateRef.current.guest[slot]) return;
    const decision = ruleGuestDecision(buildGuestRequest(stateRef.current, level));
    dispatch({ type: "GUEST_DECISION", slot, decision });
  }, []);

  /** Called by the active minigame when its success condition is met. */
  const completeTask = useCallback(() => {
    sfx.success();
    setTimeout(() => {
      sfx.blackout();
      dispatch({ type: "TASK_DONE" });
    }, 900);
  }, []);

  // Timed stages (blackouts, ending sequence) advance on their own.
  useEffect(() => {
    const ms = TIMED_STAGES[state.stage];
    if (ms === undefined) return;
    if (state.stage === "mom_returns") sfx.door();
    const door =
      state.stage === "intro_leave" ? setTimeout(() => sfx.door(), ms - 1600) : undefined;
    const t = setTimeout(() => dispatch({ type: "ADVANCE" }), ms);
    return () => {
      clearTimeout(t);
      if (door) clearTimeout(door);
    };
  }, [state.stage]);

  const submitAnswer = useCallback(
    async (questionType: QuestionType, answer: string) => {
      dispatch({ type: "AI_REQUEST" });
      sfx.hum();
      const response = await interpretAnswerSafe({
        questionType,
        answer,
        // the player's name never leaves the device
        memory: {
          ...(state.memory.favoriteColor ? { favoriteColor: state.memory.favoriteColor } : {}),
          ...(state.memory.favoriteToy ? { favoriteToy: state.memory.favoriteToy } : {}),
        },
      });
      dispatch({
        type: "AI_RESULT",
        monsterLine: response.monsterLine,
        ...(response.displayAnswer ? { displayAnswer: response.displayAnswer } : {}),
        ...(response.normalizedColor ? { normalizedColor: response.normalizedColor } : {}),
        ...(response.normalizedToy ? { normalizedToy: response.normalizedToy } : {}),
      });
    },
    [state.memory],
  );

  // After the monster speaks, the player taps to continue.
  const advance = useCallback(() => {
    sfx.click();
    dispatch({ type: "ADVANCE" });
  }, []);

  const setName = useCallback((name: string) => {
    sfx.click();
    dispatch({ type: "SET_NAME", name });
  }, []);

  const replay = useCallback(() => {
    sfx.click();
    dispatch({ type: "REPLAY" });
  }, []);

  return {
    state,
    start,
    setName,
    completeTask,
    submitAnswer,
    advance,
    replay,
    requestGuest,
    ensureGuest,
  };
}
