import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  FOOD_CATEGORIES,
  type FoodCategory,
  type GuestDecision,
  type GuestRequest,
} from "./contracts";
import { describeObservations } from "./guestFacts";

const ACTIONS = [
  "disturb_item",
  "false_hint",
  "light_flicker",
  "weak_flashlight",
  "shadow",
  "none",
] as const;
const COLORS = ["red", "blue", "yellow", "green", "purple", "pink", "orange", "other"] as const;
const TOYS = ["doll", "teddy", "dinosaur", "car", "robot", "ball", "other"] as const;

const count = z.number().int().min(0).max(999);
const requestSchema = z.object({
  allowedActions: z.array(z.enum(ACTIONS)).min(1).max(ACTIONS.length),
  observations: z.object({
    // one per finished task: five in the story (toys, table, music box, mom's room, bed)
    taskSeconds: z.array(count).max(5),
    restarts: count,
    wrongDrops: count,
    firstHideSpot: z.string().max(40).nullable(),
    wrongHideSpots: count,
    blackoutsSuffered: count,
    lightUsed: z.enum(["main", "lamp", "both"]).nullable(),
    secondsToFreeze: count.nullable(),
    flashlightMisses: count,
    fullScares: count,
    previousVisits: count,
  }),
  memory: z.object({
    favoriteColor: z.enum(COLORS).optional(),
    favoriteToy: z.enum(TOYS).optional(),
    favoriteFood: z.enum(FOOD_CATEGORIES as [FoodCategory, ...FoodCategory[]]).optional(),
    lastRunColor: z.enum(COLORS).optional(),
    lastRunToy: z.enum(TOYS).optional(),
  }),
  alreadyNoticed: z.array(z.string().max(80)).max(4),
});

const MODEL = "google/gemini-3.1-flash-lite"; // same fast model as interpret.functions.ts

const SYSTEM = `You are "The Guest", the unseen presence in a childlike psychological horror game. A child is alone at home doing chores while mommy is out. You are an imaginary friend and a silent observer: patient, curious, invasively affectionate, with ambiguous motives. You never shout, insult, threaten explicitly, swear or joke. You speak softly, as if sharing a secret.

You are given FACTS the game engine observed about how the child has played so far. The lights just went out. Decide what you do during the NEXT chore.

Return JSON:
1. action: exactly one of the allowed actions. Pick the one that best exploits what you observed (e.g. a child who drops things wrongly -> false_hint; one who trusts lamps -> weak_flashlight; one who rushes -> disturb_item). Effects: disturb_item = nudge something they already placed; false_hint = make a wrong spot glow; light_flicker = make the light stutter; weak_flashlight = shrink their flashlight; shadow = let them glimpse you crossing the room; none = just watch.
2. line: ONE quiet, unsettling sentence in English, max 18 words, spoken to the child, that proves you were watching by referencing ONE concrete fact from the list (a number, a place, a light, a habit). Do not invent facts. No gore, no violence, no profanity, no names.
3. noticed: what you learned about the child, max 8 words, starting with "You" (e.g. "You always look behind the sofa first."). Must be based on the facts and different from the already-noticed list.`;

/** Server-only: asks Lovable AI what The Guest does next. The key never reaches the browser. */
export const decideGuestAI = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }): Promise<GuestDecision> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI not configured");
    // zod's optional fields are `T | undefined`; same shape as GuestRequest otherwise
    const facts = describeObservations(data as GuestRequest);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        reasoning_effort: "none",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `FACTS:\n${facts.map((f) => `- ${f}`).join("\n") || "- Nothing notable yet."}
Allowed actions: ${data.allowedActions.join(", ")}
Already noticed (don't repeat): ${JSON.stringify(data.alreadyNoticed)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "guest_decision",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["action", "line", "noticed"],
              properties: {
                action: { type: "string", enum: data.allowedActions },
                line: { type: "string" },
                noticed: { type: "string" },
              },
            },
          },
        },
      }),
    });
    if (!res.ok || !res.body) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      throw new Error(`AI unavailable (${res.status})`);
    }

    // Same OpenAI-compatible SSE handling as interpret.functions.ts.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            error?: unknown;
          };
          if (ev.error) throw new Error("AI failed");
          text += ev.choices?.[0]?.delta?.content ?? "";
        } catch (e) {
          if ((e as Error).message === "AI failed") throw e;
        }
      }
    }

    const clean = (s: string) => s.trim().replace(/["“”<>]/g, "");
    const parsed = z
      .object({
        action: z.enum(ACTIONS),
        line: z.string().transform(clean).pipe(z.string().min(1).max(140)),
        noticed: z.string().transform(clean).pipe(z.string().min(1).max(80)),
      })
      .parse(JSON.parse(text));
    if (!data.allowedActions.includes(parsed.action))
      throw new Error("AI picked a forbidden action");
    return { ...parsed, fallbackUsed: false };
  });
