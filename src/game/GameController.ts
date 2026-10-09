import { useCallback, useEffect, useReducer } from "react";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import type { QuestionType } from "@/ai/contracts";
import { gameReducer, initialGameState, type GameStage } from "./GameState";
import { initAudio, sfx } from "./audio";

/** how long a blackout lingers before the question appears */
export const BLACKOUT_MS = 3200;

/** auto-advance timings for the timed stages (ms) */
const TIMED_STAGES: Partial<Record<GameStage, number>> = {
  intro_leave: 8200, // typing + door; tap also continues
  blackout_one: BLACKOUT_MS,
  blackout_two: BLACKOUT_MS,
  blackout_three: BLACKOUT_MS,
  knock: 2600,
  mother_voice: 9000, // tap also continues
  final_dark: 2200,
};

export function useGameController() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  const start = useCallback(() => {
    initAudio();
    sfx.click();
    dispatch({ type: "START" });
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
    if (state.stage === "knock") {
      sfx.knock();
    }
    if (state.stage === "final_dark") sfx.blackout();
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

  return { state, start, setName, completeTask, submitAnswer, advance, replay };
}
