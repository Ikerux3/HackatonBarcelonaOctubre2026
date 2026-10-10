import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  GUEST_VOICE_ROLES,
  isElevenLabsEnabled,
  type GuestVoiceRole,
} from "./guestVoice";

const requestSchema = z.object({
  role: z.enum(GUEST_VOICE_ROLES),
  text: z.string().trim().min(1).max(220),
});

type ElevenLabsSpeechResult =
  { available: false } | { available: true; audioBase64: string; mimeType: "audio/mpeg" };

const MODEL_ID = "eleven_flash_v2_5";
const cache = new Map<string, Promise<ElevenLabsSpeechResult>>();
const MAX_CACHE_ENTRIES = 48;

function voiceIdForRole(role: GuestVoiceRole): string | undefined {
  const guest = process.env["ELEVENLABS_GUEST_VOICE_ID"]?.trim();
  const mom = process.env["ELEVENLABS_MOM_VOICE_ID"]?.trim() || guest;
  if (role === "mom") return mom;
  if (role === "mom_impostor")
    return process.env["ELEVENLABS_MOM_IMPOSTOR_VOICE_ID"]?.trim() || mom;
  return guest;
}

function voiceSettings(role: GuestVoiceRole) {
  if (role === "mom")
    return { stability: 0.62, similarity_boost: 0.78, style: 0.08, use_speaker_boost: true };
  if (role === "mom_impostor")
    return { stability: 0.42, similarity_boost: 0.8, style: 0.18, use_speaker_boost: true };
  return { stability: 0.48, similarity_boost: 0.76, style: 0.16, use_speaker_boost: true };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function requestSpeech(text: string, role: GuestVoiceRole): Promise<ElevenLabsSpeechResult> {
  if (!isElevenLabsEnabled(process.env["ELEVENLABS_ENABLED"])) return { available: false };
  const apiKey = process.env["ELEVENLABS_API_KEY"]?.trim();
  const voiceId = voiceIdForRole(role);
  if (!apiKey || !voiceId) return { available: false };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: voiceSettings(role),
      }),
    },
  );

  if (!response.ok) {
    console.error("ElevenLabs TTS error", response.status);
    throw new Error(`TTS unavailable (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 2_500_000) throw new Error("Invalid TTS audio response");
  return { available: true, audioBase64: bytesToBase64(bytes), mimeType: "audio/mpeg" };
}

/** Server-only ElevenLabs proxy. Voice IDs and the API key never reach the browser. */
export const synthesizeGuestVoice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }): Promise<ElevenLabsSpeechResult> => {
    // Check before the cache too: disabled requests must never call or prime ElevenLabs.
    if (!isElevenLabsEnabled(process.env["ELEVENLABS_ENABLED"])) return { available: false };
    const cacheKey = `${data.role}\n${data.text}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value ?? "");
    const pending = requestSpeech(data.text, data.role).catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });
    cache.set(cacheKey, pending);
    return pending;
  });
