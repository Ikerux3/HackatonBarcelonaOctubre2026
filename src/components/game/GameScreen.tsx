import { useGameController } from "@/game/GameController";
import { colorLabel, guestNotes, toyLabel, type GuestSlot } from "@/game/GameState";
import { applyGuestAction, guestOverlay } from "@/game/guestEffects";
import { forgetGuestMemory, observe, rememberRun } from "@/game/observer";
import { AIDebugBadge } from "./AIDebugBadge";
import { GuestOverlay } from "./GuestOverlay";
import { useEffect, useRef, useState } from "react";

import {
  haptic,
  initAudio,
  setMusicDetune,
  startDrone,
  startMusicBox,
  stopDrone,
  stopMusicBox,
} from "@/game/audio";
import { loadStoryLevels, type StoryLevels } from "@/game/demoProfile";
import { STORY_LEVELS } from "@/game/levels/defaultLevels";
import { MinigameHost } from "@/components/minigames/MinigameHost";
import { EndingScreen } from "./EndingScreen";
import { EndingSequence } from "./EndingSequence";
import { IntroName } from "./IntroName";
import { MonsterOverlay } from "./MonsterOverlay";
import { QuestionInput } from "./QuestionInput";

const QUESTIONS = {
  question_one: "What's your favorite color?",
  question_two: "What was your favorite childhood toy?",
} as const;

export function GameScreen() {
  return (
    <>
      <GameScreenInner />
      <AIDebugBadge />
    </>
  );
}

function GameScreenInner() {
  const {
    state,
    start,
    setName,
    completeTask,
    submitAnswer,
    advance,
    replay,
    requestGuest,
    ensureGuest,
  } = useGameController();
  // saved demo story (validated, per-slot fallback to built-in); read after hydration
  const [story, setStory] = useState<StoryLevels>(STORY_LEVELS);
  useEffect(() => {
    setStory(loadStoryLevels());
    // demo phones: ?forget=1 makes The Guest forget earlier players on this device
    if (new URLSearchParams(window.location.search).get("forget") === "1") forgetGuestMemory();
  }, []);

  // ---- The Guest: observe each task, plan the next one during the blackout ----
  const storyRef = useRef(story);
  storyRef.current = story;
  useEffect(() => {
    const st = state.stage;
    const s = storyRef.current;
    if (st === "task_one" || st === "task_two" || st === "task_three") observe.taskStart();
    if (st === "blackout_one" || st === "blackout_two" || st === "blackout_three") observe.taskEnd();
    // ask the model while the lights are out and the player answers the question
    if (st === "blackout_one") requestGuest("task_two", s.task_two);
    if (st === "blackout_two") requestGuest("task_three", s.task_three);
    // never start a task without a plan: rules decide if the model is late
    if (st === "task_two") ensureGuest("task_two", s.task_two);
    if (st === "task_three") ensureGuest("task_three", s.task_three);
    if (st === "ending") rememberRun(state.memory.favoriteColor, state.memory.favoriteToy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage]);

  // ---- presentation only: run timer, ambience, haptics (no game logic) ----
  const startedAt = useRef<number | null>(null);
  const [lastedMs, setLastedMs] = useState(0);
  useEffect(() => {
    const st = state.stage;
    if (st === "intro") {
      startedAt.current = null;
      stopDrone();
      return;
    }
    if (st === "task_one" && startedAt.current === null) startedAt.current = Date.now();
    if (st === "ending" && startedAt.current !== null)
      setLastedMs(Date.now() - startedAt.current);

    if (st === "intro_name" || st === "intro_leave" || st === "task_one") {
      stopDrone();
      startMusicBox();
    } else if (st === "ending" || st === "mom_returns" || st === "unsettling_detail") {
      stopMusicBox(true);
      stopDrone();
    } else {
      // every later stage is dark
      stopMusicBox();
      setMusicDetune(60);
      startDrone();
    }
    if (st === "question_one" || st === "question_two" || st === "goodnight_whisper")
      haptic([30, 80, 30]);
  }, [state.stage]);
  useEffect(() => () => {
    stopMusicBox(true);
    stopDrone();
  }, []);

  if (state.stage === "intro") {
    return (
      <div
        onPointerDown={() => {
          // first touch on the title screen unlocks audio and starts the music box
          initAudio();
          startMusicBox();
        }}
        className="game-room-cozy flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
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
        <p className="-mt-3 text-sm text-amber-900/80">Do your chores before mommy gets back</p>
      </div>
    );
  }

  if (state.stage === "ending") {
    return (
      <EndingScreen
        lastedMs={lastedMs}
        colorText={colorLabel(state)}
        toyText={toyLabel(state)}
        noticed={guestNotes(state)}
        onReplay={replay}
      />
    );
  }

  if (state.stage === "intro_name" || state.stage === "intro_leave") {
    return (
      <IntroName
        stage={state.stage}
        name={state.memory.playerName ?? null}
        onName={setName}
        onDone={advance}
      />
    );
  }

  if (
    state.stage === "goodnight_whisper" ||
    state.stage === "mom_returns" ||
    state.stage === "unsettling_detail"
  ) {
    return (
      <EndingSequence
        stage={state.stage}
        name={state.memory.playerName ?? "sweetie"}
        memory={state.memory}
        toyText={toyLabel(state)}
        colorText={colorLabel(state)}
        onSkip={advance}
      />
    );
  }

  const stage = state.stage;
  const dark = stage !== "task_one";
  const isBlackout =
    stage === "blackout_one" || stage === "blackout_two" || stage === "blackout_three";
  const isTask = stage === "task_one" || stage === "task_two" || stage === "task_three";
  const slot: GuestSlot | "task_one" =
    stage === "task_one" || stage === "blackout_one" || stage === "question_one"
      ? "task_one"
      : stage === "task_two" || stage === "blackout_two" || stage === "question_two"
        ? "task_two"
        : "task_three";
  const plan = slot === "task_one" ? undefined : state.guest[slot];
  const baseLevel = story[slot];
  const level = plan ? applyGuestAction(baseLevel, plan.action) : baseLevel;
  const isQuestion = state.stage === "question_one" || state.stage === "question_two";

  return (
    <div
      className={`flex min-h-dvh flex-col items-center gap-3 px-3 py-3 transition-colors duration-1000 ${
        isQuestion ? "pb-[55dvh]" : ""
      } ${
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

        {isTask && plan && (
          <GuestOverlay key={slot} decision={plan} {...guestOverlay(level, plan.action)} />
        )}

        {isBlackout && (
          <MonsterOverlay
            line={
              stage === "blackout_one"
                ? story.task_one.type === "tidy_roles"
                  ? story.task_one.tidy.completeLine || "The lights went out…"
                  : "The lights went out…"
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
