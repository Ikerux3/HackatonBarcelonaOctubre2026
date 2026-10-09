import { z } from "zod";

import { reportAIDiagnostics, type AdapterUsed } from "./aiAdapter";
import { getAIMode } from "./aiMode";
import type { GuestDecision, GuestRequest } from "./contracts";
import { decideGuestAI } from "./guest.functions";
import { ruleGuestDecision } from "./guestFacts";

/** The call runs during the blackout + question, so it can afford a bit longer. */
export const GUEST_TIMEOUT_MS = 6000;

const decisionSchema = z.object({
  action: z.enum([
    "disturb_item",
    "false_hint",
    "light_flicker",
    "weak_flashlight",
    "shadow",
    "none",
  ]),
  line: z.string().trim().min(1).max(140),
  noticed: z.string().trim().min(1).max(80),
  fallbackUsed: z.boolean(),
});

/**
 * What The Guest does in the next task. live = real model (falls back to the
 * rules on error, timeout, invalid data or a forbidden action); mock/scripted =
 * rules only, so demos stay predictable. Never throws.
 */
export async function decideGuest(req: GuestRequest): Promise<GuestDecision> {
  const mode = getAIMode();
  const t0 = performance.now();
  const report = (d: GuestDecision, adapterUsed: AdapterUsed, error?: string) => {
    reportAIDiagnostics({
      mode,
      adapterUsed,
      fallbackUsed: d.fallbackUsed,
      latencyMs: Math.round(performance.now() - t0),
      detail: `guest → ${d.action}`,
      ...(error ? { error } : {}),
    });
    return d;
  };

  if (mode !== "live") return report({ ...ruleGuestDecision(req), fallbackUsed: false }, mode);
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout")), GUEST_TIMEOUT_MS),
    );
    const d = decisionSchema.parse(await Promise.race([decideGuestAI({ data: req }), timeout]));
    if (!req.allowedActions.includes(d.action)) throw new Error("forbidden action");
    return report(d, "live");
  } catch (err) {
    console.warn("[guest] falling back to rules:", (err as Error).message);
    return report(ruleGuestDecision(req), "mock-fallback", (err as Error).message);
  }
}
