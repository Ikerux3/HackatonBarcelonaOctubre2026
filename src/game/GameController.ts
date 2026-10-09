import { useCallback, useEffect, useReducer } from "react";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import type { QuestionType } from "@/ai/contracts";
import { gameReducer, initialGameState } from "./GameState";
import { TABLE_ITEMS, TOYS } from "./PuzzleData";
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

  const tidyToy = useCallback(
    (id: string) => {
      if (state.stage !== "task_one" || state.toysTidied.includes(id)) return;
      sfx.click();
      dispatch({ type: "TIDY_TOY", id });
    },
    [state.stage, state.toysTidied],
  );

  const placeItem = useCallback(
    (id: string) => {
      if (state.stage !== "task_two" || state.tableSet.includes(id)) return;
      sfx.click();
      dispatch({ type: "PLACE_ITEM", id });
    },
    [state.stage, state.tableSet],
  );

  // Task completion -> success sting -> blackout.
  useEffect(() => {
    if (state.stage === "task_one" && state.toysTidied.length === TOYS.length) {
      sfx.success();
      const t = setTimeout(() => {
        sfx.blackout();
        dispatch({ type: "TASK_ONE_DONE" });
      }, 800);
      return () => clearTimeout(t);
    }
    if (state.stage === "task_two" && state.tableSet.length === TABLE_ITEMS.length) {
      sfx.success();
      const t = setTimeout(() => {
        sfx.blackout();
        dispatch({ type: "TASK_TWO_DONE" });
      }, 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.stage, state.toysTidied.length, state.tableSet.length]);

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

  return { state, start, tidyToy, placeItem, submitAnswer, advance, replay };
}
