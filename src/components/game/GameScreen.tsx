import { useGameController } from "@/game/GameController";
import { colorLabel, guestNotes, toyLabel, type GuestSlot } from "@/game/GameState";
import { applyGuestAction, guestOverlay } from "@/game/guestEffects";
import { forgetGuestMemory, observe, rememberRun } from "@/game/observer";
import { AIDebugBadge } from "./AIDebugBadge";
import { GameShell } from "./GameShell";
import { CorruptionLayer } from "./CorruptionLayer";
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

/** Mom's dress palette comes from the table level in the story (if any). */
function motherPalette(story: StoryLevels) {
  const table = Object.values(story).find((l) => l.type === "table_for_three");
  return table?.type === "table_for_three" ? table.table.motherColors : undefined;
}

export function GameScreen() {
  return (
    <GameShell>
      <GameScreenInner />
      <AIDebugBadge />
    </GameShell>
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
    rememberFood,
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
    if (st === "blackout_one" || st === "blackout_two" || st === "blackout_three")
      observe.taskEnd();
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
    if (st === "ending" && startedAt.current !== null) setLastedMs(Date.now() - startedAt.current);

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
  useEffect(
    () => () => {
      stopMusicBox(true);
      stopDrone();
    },
    [],
  );

  if (state.stage === "intro") {
    return (
      <div
        onPointerDown={() => {
          // first touch on the title screen unlocks audio and starts the music box
          initAudio();
          startMusicBox();
        }}
        className="g-title-room relative flex h-full flex-col items-center justify-center gap-5 overflow-hidden px-6 text-center"
      >
        <div className="g-grain" />
        {/* the house at night: one lit window, and someone in the other */}
        <div className="g-push-in relative mb-1 h-28 w-40" aria-hidden>
          <div
            className="absolute inset-x-2 top-0 h-12 bg-[#2a1408]"
            style={{ clipPath: "polygon(50% 0,100% 100%,0 100%)" }}
          />
          <div className="absolute inset-x-5 bottom-0 top-11 rounded-b-sm bg-[#3a1d0c] shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
            <div className="g-house-window absolute left-[16%] top-[18%] h-7 w-7 rounded-sm" />
            <div className="absolute right-[16%] top-[18%] h-7 w-7 overflow-hidden rounded-sm bg-[#0c0705]">
              <svg viewBox="0 0 28 28" className="h-full w-full">
                <ellipse cx="10" cy="13" rx="1.6" ry="1" className="g-eye g-eye-red" />
                <ellipse cx="17" cy="13" rx="1.6" ry="1" className="g-eye g-eye-red" />
              </svg>
            </div>
            <div className="absolute bottom-0 left-1/2 h-9 w-6 -translate-x-1/2 rounded-t-sm bg-[#1a0c05]" />
          </div>
        </div>
        <h1 className="g-title-glyph relative text-5xl leading-[0.95]">
          Mommy
          <br />
          <span className="text-3xl">will be</span>
          <br />
          Back
        </h1>
        <div className="g-paper-card relative max-w-xs px-5 py-4">
          <p className="font-display text-lg italic leading-snug text-[#3a2010]">
            “Sweetie, I'm just running to the store for dinner. Be a good kid: tidy your toys, set
            the table, and get ready for bed. I'll be back before you know it.”
          </p>
          <p className="mt-2 text-right font-display text-sm italic text-[#7a4a26]">— Mom ♥</p>
        </div>
        <button
          type="button"
          onClick={() => start(motherPalette(story))}
          className="g-btn g-btn-warm relative px-12 py-4 text-2xl"
        >
          Play
        </button>
        <p className="relative -mt-2 font-display text-base italic text-[#f6dcae]">
          Do your chores before mommy gets back
        </p>
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
        motherColor={state.memory.motherColor}
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
  // visual-only decay: grows with each task, peaks at the final blackout
  const corruption = (
    stage === "blackout_three" ? 3 : slot === "task_one" ? 0 : slot === "task_two" ? 1 : 2
  ) as 0 | 1 | 2 | 3;

  return (
    <div
      className={`relative flex h-full flex-col items-center justify-center px-3 py-3 transition-colors duration-1000 ${
        dark ? "g-ending-room" : "g-title-room"
      }`}
    >
      <div
        key={slot}
        data-corruption={corruption}
        className={`game-scene-fit g-stage-in relative ${isBlackout ? "game-flicker" : ""}`}
      >
        <MinigameHost
          key={level.id}
          level={level}
          memory={state.memory}
          dark={dark}
          {...(isTask ? { onComplete: completeTask, onSkip: completeTask } : {})}
          onRememberFood={rememberFood}
        />

        <CorruptionLayer level={corruption} />

        {isTask && plan && (
          <GuestOverlay key={slot} decision={plan} {...guestOverlay(level, plan.action)} />
        )}

        {isBlackout && (
          <div className="absolute inset-0 z-[55]">
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
          </div>
        )}
      </div>

      {/* full-screen, not inside the scene: when the keyboard opens the shell
          shrinks to the visible area and the input stays right above it */}
      {isQuestion && (
        <div className="absolute inset-0 z-[70]">
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
        </div>
      )}
    </div>
  );
}
