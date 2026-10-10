import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import type { FoodCategory, GuestRequest, NormalizedColor, QuestionType } from "@/ai/contracts";
import { decideGuest } from "@/ai/guestAdapter";
import { ruleGuestDecision } from "@/ai/guestFacts";
import type { CorduraLight, CorduraReporter } from "./cordura";
import {
  gameReducer,
  guestNotes,
  initialGameState,
  TASK_STAGES,
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
      ...(s.memory.favoriteFood ? { favoriteFood: s.memory.favoriteFood } : {}),
      ...(prev.lastColor ? { lastRunColor: prev.lastColor } : {}),
      ...(prev.lastToy ? { lastRunToy: prev.lastToy } : {}),
    },
    alreadyNoticed: guestNotes(s),
  };
}

/** used when no level defines mom's palette */
export const DEFAULT_MOTHER_COLORS: NormalizedColor[] = [
  "red",
  "purple",
  "pink",
  "green",
  "orange",
  "yellow",
];

/** how long a blackout lingers before the question appears */
export const BLACKOUT_MS = 3200;

/** how often the Cordura bar takes the time spent in the light or the dark */
const CORDURA_TICK_MS = 500;
/** a throttled background tab must not dump minutes of darkness at once */
const CORDURA_MAX_TICK_MS = 1000;

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

  /** `motherPalette`: colors mom's dress may have this run — one is drawn, once. */
  const start = useCallback((motherPalette: NormalizedColor[] = DEFAULT_MOTHER_COLORS) => {
    initAudio();
    sfx.click();
    observe.reset();
    const palette = motherPalette.length ? motherPalette : DEFAULT_MOTHER_COLORS;
    const motherColor = palette[Math.floor(Math.random() * palette.length)];
    dispatch({ type: "START", ...(motherColor ? { motherColor } : {}) });
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

  // ── Barra de Cordura: the active minigame reports the light, time is counted here ──
  const lightRef = useRef<CorduraLight | null>(null);
  const cordura = useMemo<CorduraReporter>(
    () => ({
      light: (l) => {
        lightRef.current = l;
      },
      fullScare: () => dispatch({ type: "FULL_SCARE" }),
    }),
    [],
  );
  useEffect(() => {
    if (!TASK_STAGES.includes(state.stage)) return;
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      const ms = Math.min(now - last, CORDURA_MAX_TICK_MS);
      last = now;
      const light = lightRef.current;
      if (light) dispatch({ type: "CORDURA_TICK", light, ms });
    }, CORDURA_TICK_MS);
    return () => clearInterval(iv);
  }, [state.stage]);

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

  const rememberFood = useCallback((favoriteFood: FoodCategory) => {
    dispatch({ type: "REMEMBER", favoriteFood });
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
    rememberFood,
    cordura,
  };
}
