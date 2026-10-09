import { useCallback, useEffect, useReducer } from "react";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import type { QuestionType } from "@/ai/contracts";
import { gameReducer, initialGameState, type GameStage } from "./GameState";
import { initAudio, sfx } from "./audio";

/** how long a blackout lingers before the question appears */
export const BLACKOUT_MS = 3200;

/** auto-advance timings for the timed stages (ms) */
const TIMED_STAGES: Partial<Record<GameStage, number>> = {
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
    const t = setTimeout(() => dispatch({ type: "ADVANCE" }), ms);
    return () => clearTimeout(t);
  }, [state.stage]);

  const submitAnswer = useCallback(
    async (questionType: QuestionType, answer: string) => {
      dispatch({ type: "AI_REQUEST" });
      sfx.hum();
      const response = await interpretAnswerSafe({
        questionType,
        answer,
        memory: state.memory,
      });
      dispatch({
        type: "AI_RESULT",
        monsterLine: response.monsterLine,
        rawAnswer: answer,
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

  const replay = useCallback(() => {
    sfx.click();
    dispatch({ type: "REPLAY" });
  }, []);

  return { state, start, completeTask, submitAnswer, advance, replay };
}
