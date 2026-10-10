import type { GuestAction, GuestDecision, GuestRequest } from "./contracts";

// Shared by the server prompt and the offline fallback: turns raw observations
// into short factual sentences about the player. Never contains player-typed text.

export function describeObservations(req: GuestRequest): string[] {
  const o = req.observations;
  const facts: string[] = [];
  // story order (GameState TASK_STAGES): a level swapped in the editor is still "a chore"
  const tasks = [
    "tidying the toys",
    "setting the table",
    "playing back the music box",
    "getting out of mom's room",
    "getting ready for bed",
  ];
  o.taskSeconds.forEach((s, i) => {
    const pace = s >= 60 ? " (slow, hesitant)" : s <= 20 ? " (fast, rushing)" : "";
    facts.push(`Took ${s} s ${tasks[i] ?? "on a chore"}${pace}.`);
  });
  if (o.restarts > 0) facts.push(`Restarted a chore ${o.restarts} time(s).`);
  if (o.wrongDrops > 0) facts.push(`Dropped things in the wrong place ${o.wrongDrops} time(s).`);
  if (o.firstHideSpot)
    facts.push(
      `When the last toy hid, looked "${o.firstHideSpot.toLowerCase()}" first${o.wrongHideSpots > 0 ? ` and guessed wrong ${o.wrongHideSpots} time(s)` : " and was right"}.`,
    );
  if (o.secondsToFreeze !== null)
    facts.push(`Took ${o.secondsToFreeze} s to catch the toy that moved in the dark.`);
  if (o.lightUsed)
    facts.push(
      o.lightUsed === "both"
        ? "Needed both lights on to make the toy stay still."
        : `Made the toy stay still with the ${o.lightUsed === "lamp" ? "small lamp" : "main light"}.`,
    );
  if (o.blackoutsSuffered > 0)
    facts.push(`Lost the light ${o.blackoutsSuffered} more time(s) while the toy ran around.`);
  if (o.flashlightMisses > 0)
    facts.push(`Tapped at things in the dark without lighting them ${o.flashlightMisses} time(s).`);
  if (o.fullScares > 0)
    facts.push(`Stayed in the dark too long and got caught by you ${o.fullScares} time(s).`);
  const m = req.memory;
  if (m.favoriteColor && m.favoriteColor !== "other")
    facts.push(`Said their favorite color is ${m.favoriteColor}.`);
  if (m.favoriteToy && m.favoriteToy !== "other")
    facts.push(`Said their favorite childhood toy was a ${m.favoriteToy}.`);
  if (m.favoriteFood && m.favoriteFood !== "other")
    facts.push(`Said their favorite food is ${m.favoriteFood.replace("_", " ")}.`);
  if (o.previousVisits > 0) {
    facts.push(`Has been in this house before (${o.previousVisits} earlier night(s)).`);
    if (m.lastRunColor && m.lastRunColor !== "other")
      facts.push(`Last time they said their favorite color was ${m.lastRunColor}.`);
    if (m.lastRunToy && m.lastRunToy !== "other")
      facts.push(`Last time they said their favorite toy was a ${m.lastRunToy}.`);
  }
  return facts;
}

const pick = (allowed: GuestAction[], ...wanted: GuestAction[]): GuestAction =>
  wanted.find((a) => allowed.includes(a)) ?? (allowed.includes("none") ? "none" : allowed[0]!);

/**
 * Deterministic stand-in used by mock/scripted modes and whenever the live model
 * fails or is slow. Still reacts to what the player did, so runs differ.
 */
export function ruleGuestDecision(req: GuestRequest): GuestDecision {
  const o = req.observations;
  const allowed = req.allowedActions;
  const seen = new Set(req.alreadyNoticed);
  const last = o.taskSeconds.at(-1) ?? 0;
  const options: Omit<GuestDecision, "fallbackUsed">[] = [];

  if (o.previousVisits > 0 && req.memory.lastRunColor && req.memory.lastRunColor !== "other")
    options.push({
      action: pick(allowed, "shadow", "light_flicker"),
      line: `You came back. Last time it was ${req.memory.lastRunColor}. I kept it.`,
      noticed: "You came back to me.",
    });
  if (o.firstHideSpot)
    options.push({
      action: pick(allowed, "false_hint", "shadow", "light_flicker"),
      line: `${o.firstHideSpot} first. Everyone looks there. I'll hide somewhere new.`,
      noticed: `You look ${o.firstHideSpot.toLowerCase()} first.`,
    });
  if (o.wrongDrops >= 2)
    options.push({
      action: pick(allowed, "false_hint", "disturb_item", "light_flicker"),
      line: "Your little hands keep missing. Let me help you.",
      noticed: "You miss when you're nervous.",
    });
  if (o.lightUsed === "lamp" || o.lightUsed === "both")
    options.push({
      action: pick(allowed, "weak_flashlight", "light_flicker", "shadow"),
      line: "You trust the little lamp. Lights can be taken away.",
      noticed: "You trust the little lamp.",
    });
  if (last >= 60)
    options.push({
      action: pick(allowed, "weak_flashlight", "disturb_item", "shadow"),
      line: "So slow. Mommy will be home before you finish.",
      noticed: "You take your time.",
    });
  if (last > 0 && last <= 20)
    options.push({
      action: pick(allowed, "disturb_item", "false_hint", "shadow"),
      line: "Rushing? You can't leave before I say so.",
      noticed: "You rush when you're scared.",
    });
  if (o.restarts > 0)
    options.push({
      action: pick(allowed, "disturb_item", "light_flicker", "shadow"),
      line: "Starting over won't make me go away.",
      noticed: "You like to start over.",
    });
  options.push({
    action: pick(allowed, "shadow", "light_flicker"),
    line: "I'm not hiding anymore. I'm right behind you.",
    noticed: "You never once looked behind you.",
  });

  const chosen = options.find((d) => !seen.has(d.noticed)) ?? options[options.length - 1]!;
  return { ...chosen, fallbackUsed: true };
}
