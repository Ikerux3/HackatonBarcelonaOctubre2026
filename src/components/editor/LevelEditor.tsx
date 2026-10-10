import { useEffect, useMemo, useRef, useState } from "react";

import {
  AI_MODES,
  getAIMode,
  getScriptedLines,
  setAIMode,
  setScriptedLines,
  type AIMode,
  type ScriptedLines,
} from "@/ai/aiMode";
import type { NormalizedColor, ToyCategory } from "@/ai/contracts";
import { DEFAULT_SCRIPTED } from "@/ai/aiMode";
import {
  STORY_SLOTS,
  clearStoryConfig,
  loadStoryConfig,
  parseProfileJson,
  saveStoryConfig,
  type DemoProfile,
  type StoryConfig,
  type StorySlot,
} from "@/game/demoProfile";
import { AITestBox } from "@/components/editor/AITestBox";
import { GuestVoiceProvider } from "@/components/game/GuestVoice";
import { MinigameHost } from "@/components/minigames/MinigameHost";
import { SceneBackdrop } from "@/components/minigames/SceneBackdrop";
import type { GameMemory } from "@/game/GameState";
import { ASSETS, ASSET_IDS, COLORS, COLOR_HEX, type AssetId } from "@/game/levels/assets";
import {
  BEDTIME,
  BUILT_IN_LEVELS,
  MOM_ROOM,
  MUSIC_BOX,
  SET_TABLE,
  STORY_LEVELS,
  TIDY_TOYS,
  TIDY_TOYS_DRAG,
} from "@/game/levels/defaultLevels";
import type {
  FlashlightOptions,
  MomRoomOptions,
  MusicBoxOptions,
  TidyOptions,
  TidyRole,
  LevelConfig,
  SceneObject,
  TargetZone,
} from "@/game/levels/types";
import { TidyExtrasEditor, TidyExtrasMarkers } from "./TidyExtrasEditor";
import { MINIGAME_TYPES, SCENE_THEMES, TIDY_ROLES } from "@/game/levels/types";
import { parseLevelJson, validateLevel } from "@/game/levels/validate";

const STORAGE_KEY = "mwbb.editor.levels.v1";
const TOYS: ToyCategory[] = ["doll", "teddy", "dinosaur", "car", "robot", "ball", "other"];

interface Entry {
  key: string;
  level: LevelConfig;
  builtIn: boolean;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, Math.round(n * 10) / 10));

function loadLocal(): Entry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r: { key?: string; level?: unknown }) => {
      const v = validateLevel(r?.level);
      // keep invalid drafts too — editor shows their errors; skip only non-objects
      return r && typeof r.level === "object" && r.level
        ? [
            {
              key: r.key ?? uid(),
              level: (v.ok ? v.level : r.level) as LevelConfig,
              builtIn: false,
            },
          ]
        : [];
    });
  } catch {
    return [];
  }
}

type Sel = { kind: "object" | "target"; id: string } | null;

const input =
  "w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100";
const btn =
  "rounded bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-700 disabled:opacity-40";
const label = "flex flex-col gap-1 text-xs text-neutral-400";

export function LevelEditor() {
  const [local, setLocal] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeKey, setActiveKey] = useState<string>("builtin-0");
  const [mode, setMode] = useState<"edit" | "play">("edit");
  const [sel, setSel] = useState<Sel>(null);
  const [mem, setMem] = useState<GameMemory>({ favoriteColor: "red", favoriteToy: "teddy" });
  const [dark, setDark] = useState(true);
  const [io, setIo] = useState("");
  const [ioErrors, setIoErrors] = useState<string[]>([]);
  const [playRound, setPlayRound] = useState(0);
  const [playDone, setPlayDone] = useState(false);

  const [aiMode, setAiModeState] = useState<AIMode>("live");
  const [scripted, setScripted] = useState<ScriptedLines | null>(null);
  // what story.json plays in each slot, as editor keys (was hard-coded and had drifted:
  // task_two pointed at "Set the table" while the story plays "Table for three")
  const DEFAULT_KEYS = Object.fromEntries(
    STORY_SLOTS.map((slot) => {
      const i = BUILT_IN_LEVELS.findIndex((l) => l.id === STORY_LEVELS[slot].id);
      return [slot, `builtin-${Math.max(0, i)}`];
    }),
  ) as Record<StorySlot, string>;
  const [storyKeys, setStoryKeys] = useState<Record<StorySlot, string>>(DEFAULT_KEYS);
  const [storyActive, setStoryActive] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string[]>([]);
  useEffect(() => {
    setAiModeState(getAIMode());
    setScripted(getScriptedLines());
    const drafts = loadLocal();
    const saved = loadStoryConfig();
    if (saved) {
      const keys = { ...DEFAULT_KEYS };
      const extra: Entry[] = [];
      for (const slot of STORY_SLOTS) {
        const src = saved[slot].source;
        if (!src) continue; // a slot the saved story didn't have yet: keep the built-in
        if (src.startsWith("builtin-") || drafts.some((d) => d.key === src)) keys[slot] = src;
        else {
          // the draft is gone: keep its snapshot as a new draft
          const key = uid();
          extra.push({ key, level: saved[slot].level, builtIn: false });
          keys[slot] = key;
        }
      }
      drafts.push(...extra);
      setStoryKeys(keys);
      setStoryActive(true);
    }
    setLocal(drafts);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (loaded)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(local.map(({ key, level }) => ({ key, level }))),
      );
  }, [local, loaded]);

  const builtIns: Entry[] = BUILT_IN_LEVELS.map((level, i) => ({
    key: `builtin-${i}`,
    level,
    builtIn: true,
  }));
  const all = [...builtIns, ...local];

  const buildStory = (): StoryConfig => {
    const pick = (slot: StorySlot) => {
      const e =
        all.find((x) => x.key === storyKeys[slot]) ??
        builtIns[Number(DEFAULT_KEYS[slot].slice(8))]!;
      return { source: e.key, level: e.level };
    };
    return {
      task_one: pick("task_one"),
      task_two: pick("task_two"),
      task_music: pick("task_music"),
      task_mom: pick("task_mom"),
      task_three: pick("task_three"),
    };
  };
  const storyChecks = STORY_SLOTS.map((slot) => {
    const e = all.find((x) => x.key === storyKeys[slot]);
    return { slot, ok: !!e && validateLevel(e.level).ok };
  });
  // keep the saved story in sync with draft edits (only valid levels are used by the player)
  useEffect(() => {
    if (loaded && storyActive) saveStoryConfig(buildStory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, storyKeys, storyActive, loaded]);

  const exportProfile = () => {
    const profile: DemoProfile = {
      kind: "mwbb-demo-profile",
      version: 1,
      story: buildStory(),
      aiMode,
      scriptedLines: scripted ?? DEFAULT_SCRIPTED,
      drafts: local.map(({ key, level }) => ({ key, level })),
    };
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mwbb-demo-profile.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importProfile = (text: string) => {
    const r = parseProfileJson(text);
    if (!r.ok) return setProfileMsg(r.errors);
    const p = r.profile;
    const merged = [
      ...local.filter((d) => !p.drafts.some((x) => x.key === d.key)),
      ...p.drafts.map((d) => ({ ...d, builtIn: false })),
    ];
    const keys = { ...DEFAULT_KEYS };
    for (const slot of STORY_SLOTS) {
      const src = p.story[slot].source;
      if (!src) continue; // an older profile without this slot: keep the built-in
      if (src.startsWith("builtin-") && Number(src.slice(8)) < BUILT_IN_LEVELS.length)
        keys[slot] = src;
      else if (merged.some((d) => d.key === src)) keys[slot] = src;
      else {
        const key = uid();
        merged.push({ key, level: p.story[slot].level, builtIn: false });
        keys[slot] = key;
      }
    }
    setLocal(merged);
    setStoryKeys(keys);
    setStoryActive(true);
    setAIMode(p.aiMode);
    setAiModeState(p.aiMode);
    setScriptedLines(p.scriptedLines);
    setScripted(p.scriptedLines);
    setProfileMsg(["Profile loaded."]);
  };
  const resetBuiltIn = () => {
    if (
      !window.confirm("Reset the story, scripted lines and AI mode to built-in? Drafts are kept.")
    )
      return;
    clearStoryConfig();
    setStoryActive(false);
    setStoryKeys(DEFAULT_KEYS);
    setScriptedLines(DEFAULT_SCRIPTED);
    setScripted(DEFAULT_SCRIPTED);
    setAIMode("live");
    setAiModeState("live");
    setProfileMsg(["Reset to built-in."]);
  };
  const playStory = () => {
    if (storyActive) saveStoryConfig(buildStory());
    window.open(`/?ai=${aiMode}`, "_blank", "noopener");
  };
  const active = all.find((e) => e.key === activeKey) ?? builtIns[0]!;
  const level = active.level;
  const check = useMemo(() => validateLevel(level), [level]);
  const readOnly = active.builtIn;

  const update = (fn: (l: LevelConfig) => void) => {
    if (readOnly) return;
    setLocal((ls) =>
      ls.map((e) =>
        e.key === active.key
          ? {
              ...e,
              level: (() => {
                const c = clone(e.level);
                fn(c);
                return c;
              })(),
            }
          : e,
      ),
    );
  };
  const addLocal = (lvl: LevelConfig) => {
    const key = uid();
    setLocal((ls) => [...ls, { key, level: lvl, builtIn: false }]);
    setActiveKey(key);
    setSel(null);
    setMode("edit");
  };

  const newFrom = (tpl: LevelConfig) =>
    addLocal({ ...clone(tpl), id: `${tpl.id}_${uid().slice(0, 4)}`, title: `${tpl.title} (new)` });
  const duplicate = () =>
    addLocal({ ...clone(level), id: `${level.id}_copy`, title: `${level.title} (copy)` });
  const remove = () => {
    if (readOnly || !window.confirm(`Delete "${level.title}"? This cannot be undone.`)) return;
    setLocal((ls) => ls.filter((e) => e.key !== active.key));
    setActiveKey("builtin-0");
  };

  const exportJson = () => {
    const text = JSON.stringify(level, null, 2);
    setIo(text);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${level.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = (text: string) => {
    const r = parseLevelJson(text);
    if (!r.ok) return setIoErrors(r.errors);
    setIoErrors([]);
    addLocal(r.level);
  };

  // ---- drag-to-position in edit mode ----
  const sceneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: "object" | "target"; id: string; dx: number; dy: number } | null>(
    null,
  );
  const pct = (e: React.PointerEvent) => {
    const r = sceneRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const startDrag = (
    e: React.PointerEvent,
    kind: "object" | "target",
    item: { id: string; x: number; y: number },
  ) => {
    e.stopPropagation();
    setSel({ kind, id: item.id });
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pct(e);
    dragRef.current = { kind, id: item.id, dx: p.x - item.x, dy: p.y - item.y };
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = pct(e);
    update((l) => {
      const list = (d.kind === "object" ? l.objects : l.targets) as Array<{
        id: string;
        x: number;
        y: number;
      }>;
      const it = list.find((o) => o.id === d.id);
      if (it) {
        it.x = clamp(p.x - d.dx, 0, 100);
        it.y = clamp(p.y - d.dy, 0, 100);
      }
    });
  };

  const selObj = sel?.kind === "object" ? level.objects.find((o) => o.id === sel.id) : undefined;
  const selTarget = sel?.kind === "target" ? level.targets.find((t) => t.id === sel.id) : undefined;

  const setObj = (id: string, patch: Partial<SceneObject>) =>
    update((l) => {
      const o = l.objects.find((x) => x.id === id);
      if (o) Object.assign(o, patch);
    });
  const setTarget = (id: string, patch: Partial<TargetZone>) =>
    update((l) => {
      const t = l.targets.find((x) => x.id === id);
      if (!t) return;
      if (patch.id && patch.id !== id)
        l.objects.forEach((o) => o.targetId === id && (o.targetId = patch.id!));
      Object.assign(t, patch);
    });

  const addObject = (asset: AssetId) => {
    const id = `${asset}_${uid().slice(0, 3)}`;
    update((l) => {
      l.objects.push({
        id,
        label: ASSETS[asset].label,
        asset,
        color: "red",
        x: 50,
        y: 80,
        size: 18,
        targetId: l.type === "flashlight_find" ? "" : (l.targets[0]?.id ?? ""),
      });
    });
    setSel({ kind: "object", id });
  };
  const addTarget = () => {
    const id = `zone_${uid().slice(0, 3)}`;
    update((l) => {
      l.targets.push({
        id,
        label: "Spot",
        shape: l.type === "drag_to_target" ? "box" : "rect",
        x: 50,
        y: 40,
        w: 18,
        h: 16,
      });
    });
    setSel({ kind: "target", id });
  };

  const isFlash = level.type === "flashlight_find";
  const flash = level.type === "flashlight_find" ? level.flashlight : null;
  const tidy = level.type === "tidy_roles" ? level.tidy : null;
  const setTidy = (fn: (t: TidyOptions) => void) =>
    update((l) => {
      if (l.type === "tidy_roles") fn(l.tidy);
    });
  const setFlash = (fn: (f: FlashlightOptions) => void) =>
    update((l) => {
      if (l.type === "flashlight_find") fn(l.flashlight);
    });

  return (
    <div className="min-h-dvh bg-neutral-950 p-4 text-neutral-100">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">
          Level Editor{" "}
          <span className="text-xs font-normal text-neutral-500">
            — dev only, saved in this browser
          </span>
        </h1>
        <p
          aria-label="Current AI mode"
          className={`ml-auto rounded-xl px-4 py-2 text-3xl font-black tracking-wide md:text-5xl ${
            aiMode === "live"
              ? "bg-emerald-900 text-emerald-200"
              : aiMode === "scripted"
                ? "bg-amber-800 text-amber-100"
                : "bg-sky-900 text-sky-200"
          }`}
        >
          AI: {aiMode.toUpperCase()}
        </p>
      </header>

      <AITestBox />

      <section className="mb-4 grid gap-3 rounded border border-neutral-800 p-3 md:grid-cols-[180px_1fr_1fr]">
        <label className={label}>
          AI mode (demo switch)
          <select
            aria-label="AI mode"
            className={input}
            value={aiMode}
            onChange={(e) => {
              const m = e.target.value as AIMode;
              setAIMode(m);
              setAiModeState(m);
            }}
          >
            {AI_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        {scripted &&
          (["favorite_color", "favorite_toy"] as const).map((q) => (
            <label key={q} className={label}>
              Scripted line — {q}
              <input
                className={input}
                maxLength={140}
                value={scripted[q]}
                onChange={(e) => {
                  const next = { ...scripted, [q]: e.target.value };
                  setScripted(next);
                  setScriptedLines(next);
                }}
              />
            </label>
          ))}
      </section>

      <section className="mb-4 flex flex-col gap-3 rounded border border-neutral-800 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-xs uppercase text-neutral-500">
            Story (demo profile){" "}
            <span className="normal-case">
              — {storyActive ? "custom, saved in this browser" : "built-in"}
            </span>
          </p>
          <button type="button" className={`${btn} bg-amber-800`} onClick={playStory}>
            ▶ Play full story
          </button>
          <button type="button" className={btn} onClick={exportProfile}>
            Export profile
          </button>
          <label className={`${btn} cursor-pointer`}>
            Import profile
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) importProfile(await f.text());
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" className={`${btn} text-red-300`} onClick={resetBuiltIn}>
            Reset to built-in
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {STORY_SLOTS.map((slot, i) => (
            <label key={slot} className={label}>
              {slot} {storyChecks[i]!.ok ? "" : "⚠ invalid — built-in will play"}
              <select
                aria-label={`Level for ${slot}`}
                className={input}
                value={storyKeys[slot]}
                onChange={(e) => {
                  setStoryKeys({ ...storyKeys, [slot]: e.target.value });
                  setStoryActive(true);
                }}
              >
                {all.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.builtIn ? "★ " : ""}
                    {e.level.title || e.level.id} · {e.level.type}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {profileMsg.length > 0 && (
          <ul
            className="list-disc rounded bg-neutral-900 p-2 pl-6 text-xs text-neutral-300"
            role="status"
          >
            {profileMsg.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_380px]">
        {/* ---- level list ---- */}
        <aside className="flex flex-col gap-2">
          <p className="text-xs uppercase text-neutral-500">Levels</p>
          {all.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => {
                setActiveKey(e.key);
                setSel(null);
              }}
              className={`rounded px-3 py-2 text-left text-sm ${e.key === active.key ? "bg-amber-800" : "bg-neutral-900 hover:bg-neutral-800"}`}
            >
              {e.level.title || e.level.id}
              <span className="block text-[10px] text-neutral-400">
                {e.builtIn ? "built-in (read-only)" : "local draft"} · {e.level.type}
              </span>
            </button>
          ))}
          <p className="mt-2 text-xs uppercase text-neutral-500">New from template</p>
          <button type="button" className={btn} onClick={() => newFrom(TIDY_TOYS_DRAG)}>
            + Drag to box
          </button>
          <button type="button" className={btn} onClick={() => newFrom(SET_TABLE)}>
            + Place items
          </button>
          <button type="button" className={btn} onClick={() => newFrom(TIDY_TOYS)}>
            + Tidy roles
          </button>
          <button type="button" className={btn} onClick={() => newFrom(BEDTIME)}>
            + Flashlight find
          </button>
          <button type="button" className={btn} onClick={duplicate}>
            Duplicate current
          </button>
          <button
            type="button"
            className={`${btn} text-red-300`}
            onClick={remove}
            disabled={readOnly}
          >
            Delete current
          </button>
        </aside>

        {/* ---- forms ---- */}
        <section className="flex flex-col gap-4">
          {readOnly && (
            <p className="rounded bg-amber-950 px-3 py-2 text-sm text-amber-200">
              Built-in levels are read-only. Press “Duplicate current” to edit a copy.
            </p>
          )}
          <fieldset
            disabled={readOnly}
            className="grid grid-cols-2 gap-3 rounded border border-neutral-800 p-3"
          >
            <legend className="px-1 text-xs uppercase text-neutral-500">Level</legend>
            <label className={label}>
              ID
              <input
                className={input}
                value={level.id}
                onChange={(e) =>
                  update((l) => {
                    l.id = e.target.value;
                  })
                }
              />
            </label>
            <label className={label}>
              Title
              <input
                className={input}
                value={level.title}
                onChange={(e) =>
                  update((l) => {
                    l.title = e.target.value;
                  })
                }
              />
            </label>
            <label className={`${label} col-span-2`}>
              Instructions
              <input
                className={input}
                value={level.instructions}
                onChange={(e) =>
                  update((l) => {
                    l.instructions = e.target.value;
                  })
                }
              />
            </label>
            <label className={label}>
              Minigame type
              <select
                className={input}
                value={level.type}
                onChange={(e) =>
                  update((l) => {
                    const t = e.target.value as LevelConfig["type"];
                    l.type = t;
                    if (l.type === "flashlight_find") {
                      l.flashlight ??= { radius: 24 };
                      l.targets = [];
                      l.objects.forEach((o) => (o.targetId = ""));
                    } else {
                      delete (l as { flashlight?: unknown }).flashlight;
                    }
                    if (l.type === "tidy_roles") {
                      if (!l.tidy) {
                        const base = clone((TIDY_TOYS as { tidy: TidyOptions }).tidy);
                        base.steps = l.objects.map(
                          (_, i) => base.steps[i] ?? { role: "plain", hint: "" },
                        );
                        l.tidy = base;
                      }
                    } else {
                      delete (l as { tidy?: unknown }).tidy;
                    }
                    if (l.type === "music_box") {
                      l.musicBox ??= clone((MUSIC_BOX as { musicBox: MusicBoxOptions }).musicBox);
                      l.musicBox.sequence = null; // the template's symbols may not exist here
                    } else {
                      delete (l as { musicBox?: unknown }).musicBox;
                    }
                    if (l.type === "mom_room") {
                      if (!l.momRoom) {
                        // the template's marks, put on this level's own objects
                        const base = clone((MOM_ROOM as { momRoom: MomRoomOptions }).momRoom);
                        const marks = Object.values(base.marks);
                        const ids = l.objects.map((o) => o.id);
                        base.marks = Object.fromEntries(
                          ids.map((id, i) => [id, marks[i % marks.length]!]),
                        );
                        base.order = ids;
                        l.momRoom = base;
                      }
                    } else {
                      delete (l as { momRoom?: unknown }).momRoom;
                    }
                  })
                }
              >
                {MINIGAME_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Scene theme
              <select
                className={input}
                value={level.theme}
                onChange={(e) =>
                  update((l) => {
                    l.theme = e.target.value as LevelConfig["theme"];
                  })
                }
              >
                {SCENE_THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset
            disabled={readOnly}
            className="grid grid-cols-2 gap-3 rounded border border-neutral-800 p-3"
          >
            <legend className="px-1 text-xs uppercase text-neutral-500">Rules</legend>
            <label className={label}>
              Success
              <select
                className={input}
                value={level.success.kind}
                onChange={(e) =>
                  update((l) => {
                    l.success =
                      e.target.value === "all_placed"
                        ? { kind: "all_placed" }
                        : { kind: "min_placed", count: Math.max(1, l.objects.length - 1) };
                  })
                }
              >
                <option value="all_placed">All objects placed</option>
                <option value="min_placed">At least N placed</option>
              </select>
            </label>
            {level.success.kind === "min_placed" ? (
              <label className={label}>
                N
                <input
                  type="number"
                  className={input}
                  value={level.success.count}
                  onChange={(e) =>
                    update((l) => {
                      l.success = { kind: "min_placed", count: Number(e.target.value) };
                    })
                  }
                />
              </label>
            ) : (
              <span />
            )}
            <label className={label}>
              Monster interrupts
              <select
                className={input}
                value={level.monster.trigger}
                onChange={(e) =>
                  update((l) => {
                    l.monster.trigger = e.target.value as LevelConfig["monster"]["trigger"];
                  })
                }
              >
                <option value="after_half">Halfway through</option>
                <option value="on_complete">From the start / at end</option>
              </select>
            </label>
            <label className={label}>
              Intervention
              <select
                className={input}
                value={level.monster.intervention}
                onChange={(e) =>
                  update((l) => {
                    l.monster.intervention = e.target
                      .value as LevelConfig["monster"]["intervention"];
                  })
                }
              >
                <option value="none">none</option>
                <option value="disturb_item">disturb_item (wobble placed item)</option>
                <option value="light_disturbance">light_disturbance</option>
                <option value="false_hint">false_hint</option>
              </select>
            </label>
            <label className={label}>
              Uses player answer
              <select
                className={input}
                value={level.personalization.source}
                onChange={(e) =>
                  update((l) => {
                    const s = e.target.value as LevelConfig["personalization"]["source"];
                    l.personalization = {
                      source: s,
                      transform:
                        s === "favorite_color"
                          ? "color_removed"
                          : s === "favorite_toy"
                            ? "toy_shadow"
                            : "none",
                    };
                  })
                }
              >
                <option value="none">none</option>
                <option value="favorite_color">favorite_color</option>
                <option value="favorite_toy">favorite_toy</option>
              </select>
            </label>
            <label className={label}>
              Transformation
              <input className={input} value={level.personalization.transform} readOnly />
            </label>
          </fieldset>

          {tidy && (
            <fieldset
              disabled={readOnly}
              className="grid grid-cols-2 gap-3 rounded border border-neutral-800 p-3"
            >
              <legend className="px-1 text-xs uppercase text-neutral-500">Tidy roles</legend>
              <label className={label}>
                Seed (empty = random every run)
                <input
                  type="number"
                  className={input}
                  value={tidy.seed ?? ""}
                  placeholder="random"
                  onChange={(e) =>
                    setTidy((t) => {
                      t.seed =
                        e.target.value === ""
                          ? null
                          : Math.max(0, Math.floor(Number(e.target.value)));
                    })
                  }
                />
              </label>
              <label className={label}>
                Monster line after the last toy
                <input
                  className={input}
                  maxLength={140}
                  value={tidy.completeLine}
                  onChange={(e) =>
                    setTidy((t) => {
                      t.completeLine = e.target.value;
                    })
                  }
                />
              </label>
              <div className="col-span-2 flex flex-col gap-1">
                <p className="text-xs text-neutral-400">
                  Toy pool (needs at least {level.objects.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {ASSET_IDS.map((a) => {
                    const on = tidy.pool.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        aria-pressed={on}
                        className={`rounded px-2 py-1 text-xs ${on ? "bg-amber-700" : "bg-neutral-800"}`}
                        onClick={() =>
                          setTidy((t) => {
                            t.pool = on ? t.pool.filter((x) => x !== a) : [...t.pool, a];
                          })
                        }
                      >
                        {ASSETS[a].emoji} {a}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <p className="text-xs text-neutral-400">
                  Steps — role of the 1st, 2nd, 3rd… toy put away (order, not which toy)
                </p>
                {tidy.steps.map((st, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 text-xs text-neutral-500">#{i + 1}</span>
                    <select
                      aria-label={`Step ${i + 1} role`}
                      className={`${input} w-28`}
                      value={st.role}
                      onChange={(e) =>
                        setTidy((t) => {
                          t.steps[i]!.role = e.target.value as TidyRole;
                        })
                      }
                    >
                      {TIDY_ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <input
                      aria-label={`Step ${i + 1} hint`}
                      className={input}
                      maxLength={80}
                      value={st.hint}
                      onChange={(e) =>
                        setTidy((t) => {
                          t.steps[i]!.hint = e.target.value;
                        })
                      }
                    />
                  </div>
                ))}
                {tidy.steps.length !== level.objects.length && (
                  <button
                    type="button"
                    className={`${btn} self-start`}
                    onClick={() =>
                      setTidy((t) => {
                        t.steps = level.objects.map(
                          (_, i) => t.steps[i] ?? { role: "plain", hint: "" },
                        );
                      })
                    }
                  >
                    Match steps to {level.objects.length} objects
                  </button>
                )}
              </div>
              {(["cushion", "drawer"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="w-14">{k}</span>
                  {(["x", "y"] as const).map((c) => (
                    <input
                      key={c}
                      type="number"
                      aria-label={`${k} ${c}`}
                      className={`${input} w-20`}
                      value={tidy[k][c]}
                      onChange={(e) =>
                        setTidy((t) => {
                          t[k][c] = Number(e.target.value);
                        })
                      }
                    />
                  ))}
                </div>
              ))}
              <TidyExtrasEditor tidy={tidy} setTidy={setTidy} />
              <p className="col-span-2 text-xs text-neutral-500">
                Objects are toy slots (position + color); sprites come from the pool. All go into
                the box target.
              </p>
            </fieldset>
          )}

          {flash && (
            <fieldset
              disabled={readOnly}
              className="grid grid-cols-2 gap-3 rounded border border-neutral-800 p-3"
            >
              <legend className="px-1 text-xs uppercase text-neutral-500">Flashlight</legend>
              <label className={label}>
                Light radius (% of width, 10–50)
                <input
                  type="number"
                  className={input}
                  value={flash.radius}
                  onChange={(e) =>
                    setFlash((f) => {
                      f.radius = Number(e.target.value);
                    })
                  }
                />
              </label>
              <label className={label}>
                Evasive object
                <select
                  className={input}
                  value={flash.evasive?.objectId ?? ""}
                  onChange={(e) =>
                    setFlash((f) => {
                      const id = e.target.value;
                      if (!id) delete f.evasive;
                      else
                        f.evasive = {
                          objectId: id,
                          positions: f.evasive?.positions ?? [{ x: 50, y: 80 }],
                          whisper: f.evasive?.whisper ?? "Not there…",
                        };
                    })
                  }
                >
                  <option value="">— none —</option>
                  {level.objects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}
                    </option>
                  ))}
                </select>
              </label>
              {flash.evasive && (
                <>
                  <label className={`${label} col-span-2`}>
                    Monster whisper when it flees
                    <input
                      className={input}
                      maxLength={140}
                      value={flash.evasive.whisper}
                      onChange={(e) =>
                        setFlash((f) => {
                          if (f.evasive) f.evasive.whisper = e.target.value;
                        })
                      }
                    />
                  </label>
                  <div className="col-span-2 flex flex-col gap-1">
                    <p className="text-xs text-neutral-400">
                      Hiding spots (the farthest from the light is used)
                    </p>
                    {flash.evasive.positions.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 text-xs text-neutral-500">#{i + 1}</span>
                        {(["x", "y"] as const).map((k) => (
                          <input
                            key={k}
                            type="number"
                            aria-label={`Spot ${i + 1} ${k}`}
                            className={`${input} w-20`}
                            value={p[k]}
                            onChange={(e) =>
                              setFlash((f) => {
                                const pos = f.evasive?.positions[i];
                                if (pos) pos[k] = Number(e.target.value);
                              })
                            }
                          />
                        ))}
                        <button
                          type="button"
                          className={`${btn} text-red-300`}
                          disabled={flash.evasive!.positions.length <= 1}
                          onClick={() =>
                            setFlash((f) => {
                              f.evasive?.positions.splice(i, 1);
                            })
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={`${btn} self-start`}
                      disabled={flash.evasive.positions.length >= 8}
                      onClick={() =>
                        setFlash((f) => {
                          f.evasive?.positions.push({ x: 50, y: 50 });
                        })
                      }
                    >
                      + Add hiding spot
                    </button>
                  </div>
                </>
              )}
              <p className="col-span-2 text-xs text-neutral-500">
                With “favorite_toy” personalization, the evasive object shows the player's toy.
              </p>
            </fieldset>
          )}

          <fieldset
            disabled={readOnly}
            className="flex flex-col gap-2 rounded border border-neutral-800 p-3"
          >
            <legend className="px-1 text-xs uppercase text-neutral-500">Objects & targets</legend>
            <div className="flex flex-wrap gap-2">
              <select
                className={`${input} w-auto`}
                value=""
                onChange={(e) => e.target.value && addObject(e.target.value as AssetId)}
              >
                <option value="">+ Add object…</option>
                {ASSET_IDS.map((a) => (
                  <option key={a} value={a}>
                    {ASSETS[a].emoji} {ASSETS[a].label}
                  </option>
                ))}
              </select>
              {!isFlash && (
                <button type="button" className={btn} onClick={addTarget}>
                  + Add target zone
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {level.objects.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSel({ kind: "object", id: o.id })}
                  className={`rounded px-2 py-1 text-xs ${sel?.id === o.id ? "bg-amber-700" : "bg-neutral-800"}`}
                >
                  {ASSETS[o.asset]?.emoji} {o.id}
                </button>
              ))}
              {level.targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSel({ kind: "target", id: t.id })}
                  className={`rounded border border-dashed border-neutral-500 px-2 py-1 text-xs ${sel?.id === t.id ? "bg-amber-700" : ""}`}
                >
                  ◻ {t.id}
                </button>
              ))}
            </div>

            {selObj && (
              <div className="grid grid-cols-3 gap-2 rounded bg-neutral-900 p-2">
                <label className={label}>
                  ID
                  <input
                    className={input}
                    value={selObj.id}
                    onChange={(e) => {
                      setObj(selObj.id, { id: e.target.value });
                      setSel({ kind: "object", id: e.target.value });
                    }}
                  />
                </label>
                <label className={label}>
                  Label
                  <input
                    className={input}
                    value={selObj.label}
                    onChange={(e) => setObj(selObj.id, { label: e.target.value })}
                  />
                </label>
                <label className={label}>
                  Sprite
                  <select
                    className={input}
                    value={selObj.asset}
                    onChange={(e) => setObj(selObj.id, { asset: e.target.value as AssetId })}
                  >
                    {ASSET_IDS.map((a) => (
                      <option key={a} value={a}>
                        {ASSETS[a].emoji} {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Color
                  <select
                    className={input}
                    value={selObj.color}
                    onChange={(e) =>
                      setObj(selObj.id, { color: e.target.value as NormalizedColor })
                    }
                  >
                    {COLORS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className={`${label} ${isFlash ? "hidden" : ""}`}>
                  Goes into
                  <select
                    className={input}
                    value={selObj.targetId}
                    onChange={(e) => setObj(selObj.id, { targetId: e.target.value })}
                  >
                    <option value="">— none —</option>
                    {level.targets.map((t) => (
                      <option key={t.id}>{t.id}</option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Size
                  <input
                    type="number"
                    className={input}
                    value={selObj.size}
                    onChange={(e) => setObj(selObj.id, { size: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  X %
                  <input
                    type="number"
                    className={input}
                    value={selObj.x}
                    onChange={(e) => setObj(selObj.id, { x: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  Y %
                  <input
                    type="number"
                    className={input}
                    value={selObj.y}
                    onChange={(e) => setObj(selObj.id, { y: Number(e.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  className={`${btn} self-end text-red-300`}
                  onClick={() => {
                    update((l) => {
                      l.objects = l.objects.filter((o) => o.id !== selObj.id);
                    });
                    setSel(null);
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            {selTarget && (
              <div className="grid grid-cols-3 gap-2 rounded bg-neutral-900 p-2">
                <label className={label}>
                  ID
                  <input
                    className={input}
                    value={selTarget.id}
                    onChange={(e) => {
                      setTarget(selTarget.id, { id: e.target.value });
                      setSel({ kind: "target", id: e.target.value });
                    }}
                  />
                </label>
                <label className={label}>
                  Label
                  <input
                    className={input}
                    value={selTarget.label}
                    onChange={(e) => setTarget(selTarget.id, { label: e.target.value })}
                  />
                </label>
                <label className={label}>
                  Shape
                  <select
                    className={input}
                    value={selTarget.shape}
                    onChange={(e) =>
                      setTarget(selTarget.id, { shape: e.target.value as TargetZone["shape"] })
                    }
                  >
                    <option>box</option>
                    <option>circle</option>
                    <option>rect</option>
                  </select>
                </label>
                <label className={label}>
                  X %
                  <input
                    type="number"
                    className={input}
                    value={selTarget.x}
                    onChange={(e) => setTarget(selTarget.id, { x: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  Y %
                  <input
                    type="number"
                    className={input}
                    value={selTarget.y}
                    onChange={(e) => setTarget(selTarget.id, { y: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  W %
                  <input
                    type="number"
                    className={input}
                    value={selTarget.w}
                    onChange={(e) => setTarget(selTarget.id, { w: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  H %
                  <input
                    type="number"
                    className={input}
                    value={selTarget.h}
                    onChange={(e) => setTarget(selTarget.id, { h: Number(e.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  className={`${btn} self-end text-red-300`}
                  onClick={() => {
                    update((l) => {
                      l.targets = l.targets.filter((t) => t.id !== selTarget.id);
                    });
                    setSel(null);
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-2 rounded border border-neutral-800 p-3">
            <p className="text-xs uppercase text-neutral-500">Import / export JSON</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={exportJson}>
                Export JSON
              </button>
              <button type="button" className={btn} onClick={() => importJson(io)}>
                Import from text box
              </button>
              <label className={`${btn} cursor-pointer`}>
                Import file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) importJson(await f.text());
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <textarea
              aria-label="Level JSON"
              className={`${input} h-40 font-mono text-xs`}
              value={io}
              onChange={(e) => setIo(e.target.value)}
              placeholder="Paste level JSON here…"
            />
            {ioErrors.length > 0 && (
              <ul
                className="list-disc rounded bg-red-950 p-2 pl-6 text-xs text-red-200"
                role="alert"
              >
                {ioErrors.map((er) => (
                  <li key={er}>{er}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ---- phone preview ---- */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${btn} ${mode === "edit" ? "bg-amber-700" : ""}`}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${btn} ${mode === "play" ? "bg-amber-700" : ""}`}
              onClick={() => {
                setMode("play");
                setPlayDone(false);
                setPlayRound((r) => r + 1);
              }}
              disabled={!check.ok}
            >
              Playtest
            </button>
            {mode === "play" && (
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setPlayDone(false);
                  setPlayRound((r) => r + 1);
                }}
              >
                Restart
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <label className={label}>
              Sim. color
              <select
                className={input}
                value={mem.favoriteColor}
                onChange={(e) =>
                  setMem({ ...mem, favoriteColor: e.target.value as NormalizedColor })
                }
              >
                {COLORS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Sim. toy
              <select
                className={input}
                value={mem.favoriteToy}
                onChange={(e) => setMem({ ...mem, favoriteToy: e.target.value as ToyCategory })}
              >
                {TOYS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-neutral-300">
              <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />{" "}
              Lights out
            </label>
          </div>

          {!check.ok && (
            <ul className="list-disc rounded bg-red-950 p-2 pl-6 text-xs text-red-200" role="alert">
              {check.errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          )}

          <div
            className={`mx-auto w-[360px] max-w-full rounded-[2rem] border-8 border-neutral-800 p-2 ${dark ? "bg-neutral-950" : "game-room-cozy"}`}
          >
            {mode === "play" && check.ok ? (
              <>
                {/* minigames with Guest lines (table, music box) speak through this */}
                <GuestVoiceProvider>
                  <MinigameHost
                    key={playRound}
                    level={check.level}
                    memory={mem}
                    dark={dark}
                    onComplete={() => setPlayDone(true)}
                  />
                </GuestVoiceProvider>
                {playDone && (
                  <p className="mt-2 text-center text-sm font-bold text-emerald-400">
                    ✓ Level complete
                  </p>
                )}
              </>
            ) : (
              <div
                ref={sceneRef}
                onPointerMove={moveDrag}
                onPointerUp={() => (dragRef.current = null)}
                onPointerDown={() => setSel(null)}
                className="relative w-full touch-none select-none overflow-hidden rounded-2xl"
                style={{ aspectRatio: "2 / 3" }}
              >
                <SceneBackdrop theme={level.theme} dark={dark} />
                {level.targets.map((t) => (
                  <div
                    key={t.id}
                    onPointerDown={(e) => startDrag(e, "target", t)}
                    className={`absolute flex cursor-move items-center justify-center border-2 border-dashed text-[10px] text-neutral-200 ${t.shape === "circle" ? "rounded-full" : "rounded-lg"} ${t.shape === "box" ? "bg-amber-700/60" : "bg-black/30"} ${sel?.id === t.id ? "border-amber-300 ring-2 ring-amber-300" : "border-neutral-400"}`}
                    style={{
                      left: `${t.x - t.w / 2}%`,
                      top: `${t.y - t.h / 2}%`,
                      width: `${t.w}%`,
                      height: `${t.h}%`,
                    }}
                  >
                    {t.label}
                  </div>
                ))}
                {tidy &&
                  (["cushion", "drawer"] as const).map((k) => (
                    <div
                      key={k}
                      className="pointer-events-none absolute flex h-8 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border-2 border-dashed border-rose-300 text-[9px] font-bold text-rose-200"
                      style={{ left: `${tidy[k].x}%`, top: `${tidy[k].y}%` }}
                    >
                      {k}
                    </div>
                  ))}
                {tidy && <TidyExtrasMarkers tidy={tidy} />}
                {flash?.evasive?.positions.map((p, i) => (
                  <div
                    key={`spot-${i}`}
                    className="pointer-events-none absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-amber-300 text-[10px] font-bold text-amber-200"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    {i + 1}
                  </div>
                ))}
                {level.objects.map((o) => (
                  <div
                    key={o.id}
                    onPointerDown={(e) => startDrag(e, "object", o)}
                    className={`absolute flex cursor-move flex-col items-center justify-center rounded-2xl border-2 ${sel?.id === o.id ? "border-amber-300 ring-4 ring-amber-300" : "border-white/60"}`}
                    style={{
                      left: `${o.x}%`,
                      top: `${o.y}%`,
                      width: `${o.size}%`,
                      aspectRatio: "1",
                      transform: "translate(-50%,-50%)",
                      backgroundColor: COLOR_HEX[o.color] ?? "#888",
                    }}
                  >
                    <span className="pointer-events-none text-2xl">
                      {ASSETS[o.asset]?.emoji ?? "?"}
                    </span>
                    <span className="pointer-events-none text-[9px] font-bold text-white">
                      {o.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-center text-xs text-neutral-500">
            {mode === "edit"
              ? readOnly
                ? "Read-only preview"
                : "Drag objects and zones to position them"
              : "Playtest with simulated answers"}
          </p>
        </section>
      </div>
    </div>
  );
}
