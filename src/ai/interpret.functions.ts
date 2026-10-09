import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AIResponse } from "./contracts";

const COLORS = ["red", "blue", "yellow", "green", "purple", "pink", "orange", "other"] as const;
const TOYS = ["doll", "teddy", "dinosaur", "car", "robot", "ball", "other"] as const;

const requestSchema = z.object({
  questionType: z.enum(["favorite_color", "favorite_toy"]),
  answer: z.string().max(200).transform((s) => s.slice(0, 60)),
  memory: z.object({
    favoriteColor: z.enum(COLORS).optional(),
    favoriteToy: z.enum(TOYS).optional(),
  }),
});

const SYSTEM = `You are the voice of a monster in a childlike psychological horror game. A child answers a question in free text, in ANY language.
Tasks:
1. Map the answer to the closest category. Interpret vague answers ("the color of the sky" -> blue, "my grandma's old teddy" -> teddy, "a green dinosaur called Rex" -> dinosaur). Use "other" ONLY if truly impossible.
2. Write monsterLine: ONE creepy sentence, max 20 words, in English, that references the child's own wording (names, details). Childlike horror, unsettling and quiet. No gore, no profanity, no violence.
3. If the answer is offensive, nonsense or empty: category "other" and a cold line that ignores the content (e.g. "You don't want to tell me. That's fine. I'll find out.").
Return only the JSON object.`;

/** Server-only: calls Lovable AI. The key never reaches the browser. */
export const interpretAnswerAI = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }): Promise<AIResponse> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI not configured");
    const isColor = data.questionType === "favorite_color";
    const categories = isColor ? COLORS : TOYS;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: SYSTEM,
        input: `Question: ${isColor ? "What's your favorite color?" : "What was your favorite childhood toy?"}
Known about the child: ${JSON.stringify(data.memory)}
Child's answer: """${data.answer}"""`,
        text: {
          format: {
            type: "json_schema",
            name: "monster_reply",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["category", "monsterLine"],
              properties: {
                category: { type: "string", enum: [...categories] },
                monsterLine: { type: "string" },
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

    // Accumulate streamed output text.
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
          const ev = JSON.parse(payload) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
          if (ev.type === "response.failed" || ev.type === "error") throw new Error("AI failed");
        } catch (e) {
          if ((e as Error).message === "AI failed") throw e;
        }
      }
    }

    const parsed = z
      .object({ category: z.enum(categories as unknown as [string, ...string[]]), monsterLine: z.string().min(1).max(200) })
      .parse(JSON.parse(text));
    return isColor
      ? {
          questionType: "favorite_color",
          normalizedColor: parsed.category as AIResponse["normalizedColor"] & string,
          monsterLine: parsed.monsterLine,
          puzzleVariant: "color_removed",
          fallbackUsed: false,
        }
      : {
          questionType: "favorite_toy",
          normalizedToy: parsed.category as AIResponse["normalizedToy"] & string,
          monsterLine: parsed.monsterLine,
          puzzleVariant: "toy_shadow",
          fallbackUsed: false,
        };
  });
