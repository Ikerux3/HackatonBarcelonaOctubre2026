import { useCallback, useEffect, useReducer } from "react";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import type { QuestionType } from "@/ai/contracts";
import { gameReducer, initialGameState } from "./GameState";
import { initAudio, sfx } from "./audio";

/** how long a blackout lingers before the question appears */
export const BLACKOUT_MS = 3200;

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
    const stage = state.stage;
    setTimeout(() => {
      sfx.blackout();
      dispatch({ type: stage === "task_one" ? "TASK_ONE_DONE" : "TASK_TWO_DONE" });
    }, 900);
  }, [state.stage]);

  // Blackout lingers, then the monster asks its question.
  useEffect(() => {
    if (state.stage !== "blackout_one" && state.stage !== "blackout_two") return;
    const t = setTimeout(() => dispatch({ type: "ADVANCE" }), BLACKOUT_MS);
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
