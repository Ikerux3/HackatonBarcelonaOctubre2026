import type { NormalizedColor } from "@/ai/contracts";
import { ASSETS, COLOR_HEX } from "./assets";
import { MINIGAME_TYPES, SCENE_THEMES, type LevelConfig } from "./types";

export type ValidationResult = { ok: true; level: LevelConfig } | { ok: false; errors: string[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const isObj = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

/** Runtime validation for untrusted JSON (imports, localStorage drafts). Never executes anything. */
export function validateLevel(input: unknown): ValidationResult {
  const e: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["Level must be a JSON object."] };
  const l: Loose = input;

  if (!isStr(l.id) || !/^[a-z0-9_-]+$/i.test(l.id))
    e.push("id must be letters, numbers, _ or - only.");
  if (!isStr(l.title)) e.push("title is required.");
  if (typeof l.instructions !== "string") e.push("instructions must be text.");
  if (!MINIGAME_TYPES.includes(l.type as never))
    e.push(`type must be one of: ${MINIGAME_TYPES.join(", ")}.`);
  if (!SCENE_THEMES.includes(l.theme as never))
    e.push(`theme must be one of: ${SCENE_THEMES.join(", ")}.`);
  const isFlash = l.type === "flashlight_find";

  const targets = Array.isArray(l.targets) ? l.targets : [];
  if (!Array.isArray(l.targets)) e.push("targets must be a list.");
  else if (!isFlash && targets.length === 0) e.push("At least one target zone is required.");
  const targetIds = new Set<string>();
  targets.forEach((t: Loose, i: number) => {
    const n = `Target #${i + 1}`;
    if (!isObj(t)) {
      e.push(`${n} is not an object.`);
      return;
    }
    if (!isStr(t.id)) e.push(`${n}: id is required.`);
    else if (targetIds.has(t.id)) e.push(`${n}: duplicate id "${t.id}".`);
    else targetIds.add(t.id);
    if (typeof t.label !== "string") e.push(`${n}: label must be text.`);
    if (!["box", "circle", "rect"].includes(t.shape as string))
      e.push(`${n}: shape must be box, circle or rect.`);
    if (!isNum(t.x, 0, 100) || !isNum(t.y, 0, 100)) e.push(`${n}: x/y must be 0–100.`);
    if (!isNum(t.w, 4, 100) || !isNum(t.h, 4, 100)) e.push(`${n}: w/h must be 4–100.`);
  });

  const objects = Array.isArray(l.objects) ? l.objects : [];
  if (!Array.isArray(l.objects) || objects.length === 0) e.push("At least one object is required.");
  const objIds = new Set<string>();
  objects.forEach((o: Loose, i: number) => {
    const n = `Object #${i + 1}`;
    if (!isObj(o)) {
      e.push(`${n} is not an object.`);
      return;
    }
    if (!isStr(o.id)) e.push(`${n}: id is required.`);
    else if (objIds.has(o.id)) e.push(`${n}: duplicate id "${o.id}".`);
    else objIds.add(o.id);
    if (typeof o.label !== "string") e.push(`${n}: label must be text.`);
    if (!(typeof o.asset === "string" && o.asset in ASSETS))
      e.push(`${n}: unknown asset "${String(o.asset)}".`);
    if (!(typeof o.color === "string" && o.color in COLOR_HEX))
      e.push(`${n}: unknown color "${String(o.color)}".`);
    if (!isNum(o.x, 0, 100) || !isNum(o.y, 0, 100)) e.push(`${n}: x/y must be 0–100.`);
    if (!isNum(o.size, 6, 40)) e.push(`${n}: size must be 6–40.`);
    if (isFlash) {
      if (o.targetId !== "" && o.targetId !== undefined && !targetIds.has(o.targetId))
        e.push(`${n}: targetId must be empty for flashlight_find.`);
    } else if (!isStr(o.targetId)) e.push(`${n}: missing target.`);
    else if (!targetIds.has(o.targetId)) e.push(`${n}: target "${o.targetId}" does not exist.`);
  });

  if (l.type === "place_items") {
    const used = objects.filter(isObj).map((o: Loose) => o.targetId);
    const dup = used.find((t: unknown, i: number) => used.indexOf(t) !== i);
    if (dup) e.push(`place_items: target "${String(dup)}" is used by more than one object.`);
  }

  if (isFlash) {
    const f = l.flashlight;
    if (!isObj(f)) e.push("flashlight options are required.");
    else {
      if (!isNum(f.radius, 10, 50)) e.push("flashlight.radius must be 10–50.");
      if (f.evasive !== undefined) {
        const ev = f.evasive;
        if (!isObj(ev)) e.push("flashlight.evasive must be an object.");
        else {
          if (!objIds.has(ev.objectId)) e.push(`evasive object "${String(ev.objectId)}" does not exist.`);
          if (!Array.isArray(ev.positions) || ev.positions.length < 1 || ev.positions.length > 8)
            e.push("evasive.positions needs 1–8 positions.");
          else
            ev.positions.forEach((p: Loose, i: number) => {
              if (!isObj(p) || !isNum(p.x, 0, 100) || !isNum(p.y, 0, 100))
                e.push(`evasive position #${i + 1}: x/y must be 0–100.`);
            });
          if (typeof ev.whisper !== "string" || ev.whisper.length > 140)
            e.push("evasive.whisper must be text (max 140 chars).");
        }
      }
    }
  }

  if (!isObj(l.success)) e.push("success condition is required.");
  else if (l.success.kind === "min_placed") {
    if (!isNum(l.success.count, 1, objects.length || 1))
      e.push("success.count must be between 1 and the number of objects.");
  } else if (l.success.kind !== "all_placed")
    e.push("success.kind must be all_placed or min_placed.");

  if (!isObj(l.monster)) e.push("monster rule is required.");
  else {
    if (!["on_complete", "after_half"].includes(l.monster.trigger as string))
      e.push("monster.trigger is invalid.");
    if (
      !["none", "light_disturbance", "disturb_item", "false_hint"].includes(
        l.monster.intervention as string,
      )
    )
      e.push("monster.intervention is invalid.");
  }

  if (!isObj(l.personalization)) e.push("personalization is required.");
  else {
    const { source, transform } = l.personalization;
    if (!["none", "favorite_color", "favorite_toy"].includes(source as string))
      e.push("personalization.source is invalid.");
    if (!["none", "color_removed", "toy_shadow"].includes(transform as string))
      e.push("personalization.transform is invalid.");
    if (source === "favorite_color" && transform === "toy_shadow")
      e.push("toy_shadow needs the favorite_toy answer.");
    if (source === "favorite_toy" && transform === "color_removed")
      e.push("color_removed needs the favorite_color answer.");
  }

  return e.length ? { ok: false, errors: e } : { ok: true, level: input as unknown as LevelConfig };
}

export function parseLevelJson(text: string): ValidationResult {
  try {
    return validateLevel(JSON.parse(text));
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
  }
}

export type { NormalizedColor };
