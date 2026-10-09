import { useGameController } from "@/game/GameController";
import { STORY_LEVELS } from "@/game/levels/defaultLevels";
import { MinigameHost } from "@/components/minigames/MinigameHost";
import { EndingScreen } from "./EndingScreen";
import { MonsterOverlay } from "./MonsterOverlay";
import { QuestionInput } from "./QuestionInput";

const QUESTIONS = {
  question_one: "What's your favorite color?",
  question_two: "What was your favorite childhood toy?",
} as const;

export function GameScreen() {
  const { state, start, completeTask, submitAnswer, advance, replay } = useGameController();

  if (state.stage === "intro") {
    return (
      <div className="game-room-cozy flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-amber-950">
          MOMMY
          <br />
          WILL BE BACK
        </h1>
        <p className="max-w-xs font-serif text-base italic text-amber-900">
          “Sweetie, I'm just running to the store for dinner. Be a good kid, tidy your toys,
          and set the table. I'll be back before you know it.”
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

  const dark =
    state.stage === "blackout_one" ||
    state.stage === "question_one" ||
    state.stage === "blackout_two" ||
    state.stage === "question_two" ||
    state.stage === "task_two";

  const isBlackout = state.stage === "blackout_one" || state.stage === "blackout_two";
  const isTask = state.stage === "task_one" || state.stage === "task_two";
  const level =
    state.stage === "task_one" || state.stage === "blackout_one" || state.stage === "question_one"
      ? STORY_LEVELS.task_one
      : STORY_LEVELS.task_two;
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
            line={state.stage === "blackout_one" ? "The lights went out…" : "It's back…"}
          />
        )}

        {isQuestion && (
          <MonsterOverlay line={state.monsterLine}>
            <QuestionInput
              question={state.stage === "question_one" ? QUESTIONS.question_one : QUESTIONS.question_two}
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
