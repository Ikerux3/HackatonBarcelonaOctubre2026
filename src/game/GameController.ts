import { useCallback, useEffect, useReducer } from "react";

import { interpretAnswerSafe } from "@/ai/aiAdapter";
import type { QuestionType } from "@/ai/contracts";
import { gameReducer, initialGameState } from "./GameState";
import { TABLE_ITEMS, TOYS } from "./PuzzleData";
import { initAudio, sfx } from "./audio";

const BLACKOUT_MS = 3200;

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

  // Task completion -> blackout. Blackout -> question (timed).
  useEffect(() => {
    if (state.stage === "task_one" && state.toysTidied.length === TOYS.length) {
      sfx.success();
      const t = setTimeout(() => {
        sfx.blackout();
        dispatch({ type: "ADVANCE" });
        // task_one has no ADVANCE handler; go straight to blackout_one
      }, 700);
      // ADVANCE is a no-op on task_one, so force the stage directly:
      const t2 = setTimeout(() => dispatch({ type: "ADVANCE" }), 700);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
    if (state.stage === "task_two" && state.tableSet.length === TABLE_ITEMS.length) {
      sfx.success();
      const t = setTimeout(() => sfx.blackout(), 700);
      return () => clearTimeout(t);
    }
  }, [state.stage, state.toysTidied.length, state.tableSet.length]);

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

export { BLACKOUT_MS };
