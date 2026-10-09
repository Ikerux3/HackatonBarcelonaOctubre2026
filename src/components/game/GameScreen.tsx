import { useGameController } from "@/game/GameController";
import { useEffect, useState } from "react";

import { loadStoryLevels } from "@/game/demoProfile";
import { STORY_LEVELS } from "@/game/levels/defaultLevels";
import { MinigameHost } from "@/components/minigames/MinigameHost";
import { EndingScreen } from "./EndingScreen";
import { MotherSequence } from "./MotherSequence";
import { MonsterOverlay } from "./MonsterOverlay";
import { QuestionInput } from "./QuestionInput";

const QUESTIONS = {
  question_one: "What's your favorite color?",
  question_two: "What was your favorite childhood toy?",
} as const;

export function GameScreen() {
  const { state, start, completeTask, submitAnswer, advance, replay } = useGameController();
  // saved demo story (validated, per-slot fallback to built-in); read after hydration
  const [story, setStory] = useState(STORY_LEVELS);
  useEffect(() => setStory(loadStoryLevels()), []);

  if (state.stage === "intro") {
    return (
      <div className="game-room-cozy flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-amber-950">
          MOMMY
          <br />
          WILL BE BACK
        </h1>
        <p className="max-w-xs font-serif text-base italic text-amber-900">
          “Sweetie, I'm just running to the store for dinner. Be a good kid: tidy your toys, set the
          table, and get ready for bed. I'll be back before you know it.”
        </p>
        <button
          type="button"
          onClick={start}
          className="min-h-14 rounded-2xl bg-amber-900 px-10 py-4 text-lg font-bold text-amber-50 shadow-lg active:scale-95"
        >
          Play
        </button>
      </div>
    );
  }

  if (state.stage === "ending") {
    return (
      <EndingScreen
        memory={state.memory}
        rawColorAnswer={state.rawColorAnswer}
        rawToyAnswer={state.rawToyAnswer}
        onReplay={replay}
      />
    );
  }

  if (
    state.stage === "knock" ||
    state.stage === "mother_voice" ||
    state.stage === "final_dark"
  ) {
    return (
      <MotherSequence
        stage={state.stage}
        rawColorAnswer={state.rawColorAnswer}
        rawToyAnswer={state.rawToyAnswer}
        onContinue={advance}
      />
    );
  }

  const stage = state.stage;
  const dark = stage !== "task_one";
  const isBlackout =
    stage === "blackout_one" || stage === "blackout_two" || stage === "blackout_three";
  const isTask = stage === "task_one" || stage === "task_two" || stage === "task_three";
  const level =
    stage === "task_one" || stage === "blackout_one" || stage === "question_one"
      ? story.task_one
      : stage === "task_two" || stage === "blackout_two" || stage === "question_two"
        ? story.task_two
        : story.task_three;
  const isQuestion = state.stage === "question_one" || state.stage === "question_two";

  return (
    <div
      className={`flex min-h-dvh flex-col items-center gap-3 px-3 py-3 transition-colors duration-1000 ${
        dark ? "bg-neutral-950" : "game-room-cozy"
      }`}
    >
      <div className={`relative w-full max-w-md ${isBlackout ? "game-flicker" : ""}`}>
        <MinigameHost
          key={level.id}
          level={level}
          memory={state.memory}
          dark={dark}
          {...(isTask ? { onComplete: completeTask, onSkip: completeTask } : {})}
        />

        {isBlackout && (
          <MonsterOverlay
            line={
              stage === "blackout_one"
                ? "The lights went out…"
                : stage === "blackout_two"
                  ? "It's back…"
                  : "Lights out. Good night…"
            }
          />
        )}

        {isQuestion && (
          <MonsterOverlay line={state.monsterLine}>
            <QuestionInput
              question={
                state.stage === "question_one" ? QUESTIONS.question_one : QUESTIONS.question_two
              }
              busy={state.aiBusy}
              monsterLine={state.monsterLine}
              onSubmit={(answer) =>
                void submitAnswer(
                  state.stage === "question_one" ? "favorite_color" : "favorite_toy",
                  answer,
                )
              }
              onContinue={advance}
            />
          </MonsterOverlay>
        )}
      </div>
    </div>
  );
}
