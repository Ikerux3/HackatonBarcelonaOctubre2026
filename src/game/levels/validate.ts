import type { NormalizedColor } from "@/ai/contracts";
import { ASSETS, COLOR_HEX } from "./assets";
import {
  HIDE_SPOT_KINDS,
  MINIGAME_TYPES,
  SCENE_THEMES,
  TIDY_ROLES,
  tableKind,
  zoneCovers,
  type HideSpotKind,
  type LevelConfig,
  type LightZone,
  type Point,
  type TidyRole,
} from "./types";

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
          if (!objIds.has(ev.objectId))
            e.push(`evasive object "${String(ev.objectId)}" does not exist.`);
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

  if (l.type === "tidy_roles") {
    const t = l.tidy;
    if (!isObj(t)) e.push("tidy options are required.");
    else {
      if (t.seed !== null && !(Number.isInteger(t.seed) && t.seed >= 0 && t.seed <= 2 ** 31))
        e.push("tidy.seed must be a whole number or null (random).");
      const pool = Array.isArray(t.pool) ? t.pool : [];
      if (pool.some((a: unknown) => !(typeof a === "string" && a in ASSETS)))
        e.push("tidy.pool contains an unknown asset.");
      if (new Set(pool).size < objects.length)
        e.push(`tidy.pool needs at least ${objects.length} different assets.`);
      const steps = Array.isArray(t.steps) ? t.steps : [];
      if (steps.length !== objects.length)
        e.push(`tidy.steps needs exactly one step per object (${objects.length}).`);
      steps.forEach((s: Loose, i: number) => {
        if (!isObj(s) || !TIDY_ROLES.includes(s.role as TidyRole))
          e.push(`tidy step #${i + 1}: role must be one of ${TIDY_ROLES.join(", ")}.`);
        else if (typeof s.hint !== "string" || s.hint.length > 80)
          e.push(`tidy step #${i + 1}: hint must be text (max 80).`);
      });
      for (const k of ["cushion", "drawer"] as const)
        if (!isObj(t[k]) || !isNum(t[k].x, 0, 100) || !isNum(t[k].y, 0, 100))
          e.push(`tidy.${k} x/y must be 0–100.`);
      const roles = steps.map((s: Loose) => (isObj(s) ? s.role : null));
      const pt = (v: unknown) => isObj(v) && isNum(v.x, 0, 100) && isNum(v.y, 0, 100);
      const zone = (v: unknown) => pt(v) && isNum((v as Loose).r, 2, 100);
      const txt = (v: unknown) => typeof v === "string" && v.length <= 140;
      if (roles.includes("possessed")) {
        const p = t.possessed;
        if (!isObj(p)) e.push("tidy.possessed is required when a step is possessed.");
        else {
          const slots = Array.isArray(p.slots) ? p.slots : [];
          if (slots.length < 3 || slots.length > 4 || !slots.every(pt))
            e.push("tidy.possessed.slots needs 3–4 points (0–100).");
          if (!pt(p.mainSwitch) || !pt(p.lamp))
            e.push("tidy.possessed switch/lamp x/y must be 0–100.");
          const mz = Array.isArray(p.mainZones) ? p.mainZones : [];
          const lz = Array.isArray(p.lampZones) ? p.lampZones : [];
          if (!mz.every(zone) || !lz.every(zone) || mz.length + lz.length === 0)
            e.push("tidy.possessed zones need x/y 0–100 and r 2–100.");
          else if (slots.every(pt)) {
            // no soft-lock: every slot must be coverable by some light
            slots.forEach((sl: Point, i: number) => {
              if (![...mz, ...lz].some((z: LightZone) => zoneCovers(z, sl)))
                e.push(`tidy.possessed slot #${i + 1} is not lit by any light.`);
            });
          }
          if (!isNum(p.maxBlackouts, 1, 3)) e.push("tidy.possessed.maxBlackouts must be 1–3.");
          if (!isNum(p.safeWindowMs, 3000, 60000))
            e.push("tidy.possessed.safeWindowMs must be 3000–60000.");
          if (!isNum(p.moveMs, 400, 5000)) e.push("tidy.possessed.moveMs must be 400–5000.");
          if (!isNum(p.hintAfterMs, 3000, 120000))
            e.push("tidy.possessed.hintAfterMs must be 3000–120000.");
          if (!txt(p.possessLine) || !txt(p.freezeLine))
            e.push("tidy.possessed lines must be text (max 140).");
        }
      }
      if (roles.includes("hide_seek")) {
        const h = t.hideSeek;
        if (!isObj(h)) e.push("tidy.hideSeek is required when a step is hide_seek.");
        else {
          const spots = Array.isArray(h.spots) ? h.spots : [];
          if (
            spots.length !== 3 ||
            !spots.every(
              (s: Loose) =>
                pt(s) &&
                typeof s.label === "string" &&
                s.label.length <= 40 &&
                HIDE_SPOT_KINDS.includes(s.kind as HideSpotKind),
            )
          )
            e.push("tidy.hideSeek.spots needs exactly 3 spots (label, kind, x/y 0–100).");
          if (!isNum(h.hintAfterMs, 3000, 120000))
            e.push("tidy.hideSeek.hintAfterMs must be 3000–120000.");
          if (!txt(h.hintLine) || !txt(h.wrongLine))
            e.push("tidy.hideSeek lines must be text (max 140).");
        }
        if (roles.indexOf("hide_seek") !== roles.length - 1)
          e.push("hide_seek must be the last step.");
      }
      if (typeof t.completeLine !== "string" || t.completeLine.length > 140)
        e.push("tidy.completeLine must be text (max 140).");
      if (!targets.some((x: Loose) => isObj(x) && x.shape === "box"))
        e.push("tidy_roles needs a target with shape box.");
    }
  }

  if (l.type === "table_for_three") validateTable(l, objects, targets, e);

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

/** table_for_three: every piece findable exactly once, 3+3 pieces/slots of each kind, sane timers. */
function validateTable(l: Loose, objects: Loose[], targets: Loose[], e: string[]) {
  const t = l.table;
  if (!isObj(t)) {
    e.push("table options are required.");
    return;
  }
  const pt = (v: unknown) => isObj(v) && isNum(v.x, 0, 100) && isNum(v.y, 0, 100);
  const txt = (v: unknown, max = 140) => typeof v === "string" && v.length <= max;
  const objs = objects.filter(isObj);
  const kindOf = new Map<string, string | null>(
    objs.map((o: Loose) => [
      o.id,
      typeof o.asset === "string" ? tableKind(o.asset as never) : null,
    ]),
  );

  objs.forEach((o: Loose) => {
    if (!kindOf.get(o.id)) e.push(`table: object "${o.id}" must use asset plate, glass or fork.`);
  });
  const used = objs.map((o: Loose) => o.targetId);
  if (used.some((x: unknown, i: number) => used.indexOf(x) !== i))
    e.push("table: each slot (target) must be the target of exactly one object.");

  // owners: one plate, glass and cutlery each
  const owners = isObj(t.owners) ? t.owners : {};
  for (const owner of ["child", "mom"]) {
    const kinds = objs
      .filter((o: Loose) => owners[o.id] === owner)
      .map((o: Loose) => kindOf.get(o.id));
    if (kinds.length !== 3 || new Set(kinds).size !== 3)
      e.push(`table.owners: "${owner}" needs exactly one plate, one glass and one cutlery.`);
  }
  // sides: one slot of each kind per side
  const sides = isObj(t.sides) ? t.sides : {};
  const slotKind = (id: string) => kindOf.get(objs.find((o: Loose) => o.targetId === id)?.id);
  for (const side of ["left", "right"]) {
    const kinds = targets
      .filter((x: Loose) => isObj(x) && sides[x.id] === side)
      .map((x: Loose) => slotKind(x.id));
    if (kinds.length !== 3 || new Set(kinds).size !== 3)
      e.push(`table.sides: "${side}" needs exactly one plate, one glass and one cutlery slot.`);
  }
  if (!["left", "right", "random"].includes(t.childSide as string))
    e.push("table.childSide must be left, right or random.");

  // containers: every piece exactly once, decoys known
  const decoys = Array.isArray(t.decoys) ? t.decoys : [];
  const decoyIds = new Set<string>();
  decoys.forEach((d: Loose, i: number) => {
    if (
      !isObj(d) ||
      !isStr(d.id) ||
      typeof d.label !== "string" ||
      !(typeof d.asset === "string" && d.asset in ASSETS)
    )
      e.push(`table decoy #${i + 1} needs id, label and a known asset.`);
    else decoyIds.add(d.id);
  });
  const containers = Array.isArray(t.containers) ? t.containers : [];
  if (containers.length === 0) e.push("table.containers needs at least one cupboard or drawer.");
  const seen: string[] = [];
  containers.forEach((c: Loose, i: number) => {
    const n = `table container #${i + 1}`;
    if (!isObj(c)) return void e.push(`${n} is not an object.`);
    if (!isStr(c.id) || typeof c.label !== "string") e.push(`${n} needs id and label.`);
    if (!["cupboard", "drawer"].includes(c.kind as string))
      e.push(`${n}: kind must be cupboard or drawer.`);
    if (!pt(c) || !isNum(c.w, 4, 100) || !isNum(c.h, 4, 100)) e.push(`${n}: x/y 0–100, w/h 4–100.`);
    const contents = Array.isArray(c.contents) ? c.contents : [];
    contents.forEach((id: unknown) => {
      if (typeof id !== "string" || (!kindOf.has(id) && !decoyIds.has(id)))
        e.push(`${n}: unknown content "${String(id)}".`);
      else seen.push(id);
    });
  });
  objs.forEach((o: Loose) => {
    const count = seen.filter((s) => s === o.id).length;
    if (count !== 1)
      e.push(`table: piece "${o.id}" must be in exactly one container (found ${count}).`);
  });

  if (!(typeof t.childFallbackColor === "string" && t.childFallbackColor in COLOR_HEX))
    e.push("table.childFallbackColor must be a known color.");
  const mc = Array.isArray(t.motherColors) ? t.motherColors : [];
  if (
    mc.length === 0 ||
    mc.some((c: unknown) => !(typeof c === "string" && c in COLOR_HEX && c !== "other"))
  )
    e.push("table.motherColors needs at least one known color.");
  if (!isObj(t.doors) || !pt(t.doors.toDining) || !pt(t.doors.toKitchen))
    e.push("table.doors.toDining/toKitchen x/y must be 0–100.");
  if (!pt(t.lightSwitch)) e.push("table.lightSwitch x/y must be 0–100.");
  const d = t.dark;
  if (
    !isObj(d) ||
    !isNum(d.eyesMs, 500, 60000) ||
    !isNum(d.shakeMs, 500, 60000) ||
    !isNum(d.scareMs, 1000, 60000) ||
    !(d.eyesMs < d.shakeMs && d.shakeMs < d.scareMs)
  )
    e.push("table.dark needs eyesMs < shakeMs < scareMs (ms, 500–60000).");
  if (!isNum(t.checkpointAt, 1, 5)) e.push("table.checkpointAt must be 1–5.");
  if (!isObj(t.food) || typeof t.food.enabled !== "boolean" || !txt(t.food.question, 80))
    e.push("table.food needs enabled (true/false) and question (max 80).");
  if (!isObj(t.swap) || typeof t.swap.enabled !== "boolean")
    e.push("table.swap needs enabled (true/false).");
  const h = t.hints;
  if (!isObj(h) || !["kitchen", "dining", "dark", "finish"].every((k) => txt(h[k], 100)))
    e.push("table.hints needs kitchen, dining, dark, finish (max 100).");
  else if (
    h.howTo !== undefined &&
    !(Array.isArray(h.howTo) && h.howTo.length <= 4 && h.howTo.every((s: unknown) => txt(s, 140)))
  )
    e.push("table.hints.howTo must be up to 4 steps (max 140 chars each).");
  const ln = t.lines;
  if (
    !isObj(ln) ||
    !["decoy", "needAll", "wrong", "scare", "swap", "final"].every((k) => txt(ln[k]))
  )
    e.push("table.lines needs decoy, needAll, wrong, scare, swap, final (max 140).");
}

export function parseLevelJson(text: string): ValidationResult {
  try {
    return validateLevel(JSON.parse(text));
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
  }
}

export type { NormalizedColor };
