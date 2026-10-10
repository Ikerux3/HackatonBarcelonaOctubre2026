import { CorduraContext, corduraEnding, finalCordura } from "@/game/cordura";
import { BLACKOUT_MAX_MS, BLACKOUT_MS, useGameController } from "@/game/GameController";
import {
  colorLabel,
  guestNotes,
  TASK_STAGES,
  toyLabel,
  type GameStage,
  type GuestSlot,
} from "@/game/GameState";
import { applyGuestAction, guestOverlay } from "@/game/guestEffects";
import { forgetGuestMemory, observe, rememberRun } from "@/game/observer";
import { AIDebugBadge } from "./AIDebugBadge";
import { CorduraMeter } from "./CorduraMeter";
import { GameShell } from "./GameShell";
import { CorruptionLayer } from "./CorruptionLayer";
import { GuestOverlay } from "./GuestOverlay";
import { useEffect, useRef, useState } from "react";

import {
  haptic,
  initAudio,
  setMusicCorruption,
  sfx,
  startDrone,
  startMusicBox,
  stopDrone,
  stopMusicBox,
} from "@/game/audio";
import { corruptionLevelForStage } from "@/game/corruption";
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

/** how long the "evento 100" scare covers the scene */
const SCARE_100_MS = 1600;

/** QA only: `?debug=1&cordura=95` starts the bar there, to test the 100 event quickly. */
function debugCorduraStart(): number | undefined {
  const q = new URLSearchParams(window.location.search);
  const v = Number(q.get("cordura"));
  return q.get("debug") === "1" && q.has("cordura") && Number.isFinite(v) ? v : undefined;
}

/** Which story slot (level) is on screen at each in-game stage. */
const SLOT_OF_STAGE: Partial<Record<GameStage, GuestSlot | "task_one">> = {
  task_one: "task_one",
  blackout_one: "task_one",
  question_one: "task_one",
  task_two: "task_two",
  blackout_two: "task_two",
  question_two: "task_two",
  task_music: "task_music",
  blackout_music: "task_music",
  task_three: "task_three",
  blackout_three: "task_three",
};

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
    cordura,
  } = useGameController();
  // the ending only ever reads the value frozen when the last minigame ended
  const corduraEnd = finalCordura(state.cordura);
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
    if (TASK_STAGES.includes(st)) observe.taskStart();
    if (
      st === "blackout_one" ||
      st === "blackout_two" ||
      st === "blackout_music" ||
      st === "blackout_three"
    )
      observe.taskEnd();
    // ask the model while the lights are out and the player answers the question
    if (st === "blackout_one") requestGuest("task_two", s.task_two);
    if (st === "blackout_two") requestGuest("task_music", s.task_music);
    if (st === "blackout_music") requestGuest("task_three", s.task_three);
    // never start a task without a plan: rules decide if the model is late
    if (st === "task_two") ensureGuest("task_two", s.task_two);
    if (st === "task_music") ensureGuest("task_music", s.task_music);
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
      setMusicCorruption(0);
      stopDrone();
      return;
    }
    if (st === "task_one" && startedAt.current === null) startedAt.current = Date.now();
    if (st === "ending" && startedAt.current !== null) setLastedMs(Date.now() - startedAt.current);

    if (st === "ending" || st === "mom_returns" || st === "unsettling_detail") {
      stopMusicBox(true);
      stopDrone();
    } else if (st === "blackout_music") {
      // the player just silenced the music box (Minigame 03): only the drone until bedtime
      stopMusicBox();
    } else {
      setMusicCorruption(corruptionLevelForStage(st));
      startMusicBox();
    }

    if (st === "intro_name" || st === "intro_leave" || st === "task_one") {
      stopDrone();
    } else if (st !== "ending" && st !== "mom_returns" && st !== "unsettling_detail") {
      // Later stages keep the corrupted music box under the dark ambient drone.
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

  // D44 "evento 100": the bar hit the top — full scare over the scene while the active
  // minigame resets its current phase underneath (GameController calls its handler)
  const [scare100, setScare100] = useState(false);
  const events100 = state.cordura.events100;
  useEffect(() => {
    if (events100 === 0) return;
    setScare100(true);
    sfx.possessed();
    haptic([120, 60, 220]);
    const t = setTimeout(() => setScare100(false), SCARE_100_MS);
    return () => clearTimeout(t);
  }, [events100]);

  if (state.stage === "intro") {
    return (
      <div
        onPointerDown={() => {
          // first touch on the title screen unlocks audio and starts the music box
          initAudio();
          setMusicCorruption(0);
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
          onClick={() => start(motherPalette(story), debugCorduraStart())}
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
        cordura={corduraEnd}
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
        ending={corduraEnding(corduraEnd)}
        onSkip={advance}
      />
    );
  }

  const stage = state.stage;
  const dark = stage !== "task_one";
  const isBlackout =
    stage === "blackout_one" ||
    stage === "blackout_two" ||
    stage === "blackout_music" ||
    stage === "blackout_three";
  const isTask = TASK_STAGES.includes(stage);
  const slot = SLOT_OF_STAGE[stage] ?? "task_three";
  const plan = slot === "task_one" ? undefined : state.guest[slot];
  const baseLevel = story[slot];
  const level = plan ? applyGuestAction(baseLevel, plan.action) : baseLevel;
  const isQuestion = state.stage === "question_one" || state.stage === "question_two";
  // Art and music share the same stage-based corruption arc.
  const corruption = corruptionLevelForStage(stage);

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
        <CorduraMeter value={state.cordura.value} />
        <CorduraContext.Provider value={cordura}>
          <MinigameHost
            key={level.id}
            level={level}
            memory={state.memory}
            dark={dark}
            {...(isTask ? { onComplete: completeTask, onSkip: completeTask } : {})}
            onRememberFood={rememberFood}
          />
        </CorduraContext.Provider>

        <CorruptionLayer level={corruption} />

        {isTask && scare100 && (
          <div
            data-testid="cordura-100-scare"
            className="absolute inset-0 z-[65] flex items-center justify-center rounded-2xl bg-black"
            aria-hidden
          >
            <div className="game-eyes flex gap-10">
              <span className="h-10 w-16 rounded-full bg-red-600 shadow-[0_0_40px_12px_var(--color-red-600)]" />
              <span className="h-10 w-16 rounded-full bg-red-600 shadow-[0_0_40px_12px_var(--color-red-600)]" />
            </div>
          </div>
        )}

        {isTask && plan && (
          <GuestOverlay key={slot} decision={plan} {...guestOverlay(level, plan.action)} />
        )}

        {isBlackout && (
          <div className="absolute inset-0 z-[55]">
            <MonsterOverlay
              minimumMs={BLACKOUT_MS}
              maxWaitMs={BLACKOUT_MAX_MS}
              onReadyToAdvance={advance}
              line={
                stage === "blackout_one"
                  ? story.task_one.type === "tidy_roles"
                    ? story.task_one.tidy.completeLine || "The lights went out…"
                    : "The lights went out…"
                  : stage === "blackout_two"
                    ? "It's back…"
                    : stage === "blackout_music"
                      ? story.task_music.type === "music_box"
                        ? story.task_music.musicBox.lines.done || "It's quiet now…"
                        : "It's quiet now…"
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
