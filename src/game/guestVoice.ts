export const GUEST_VOICE_MUTED_KEY = "mommy-will-be-back:guest-voice-muted";
export const GUEST_VOICE_ID_KEY = "mommy-will-be-back:guest-voice-id";
export const GUEST_VOICE_PREVIEW_LINE = "Can you hear me, sweetie?";
export const ELEVENLABS_VOICE_ID = "elevenlabs";
export const GUEST_VOICE_ROLES = ["guest", "mom", "mom_impostor"] as const;
export type GuestVoiceRole = (typeof GUEST_VOICE_ROLES)[number];

export interface GuestSpeechRuntime {
  synthesis: Pick<SpeechSynthesis, "cancel" | "getVoices" | "speak"> &
    Partial<Pick<SpeechSynthesis, "addEventListener" | "removeEventListener">>;
  Utterance: new (text: string) => SpeechSynthesisUtterance;
}

export interface GuestVoiceOption {
  id: string;
  label: string;
}

interface GuestSpeechOptions {
  onEnd?: () => void;
  role?: GuestVoiceRole;
  voiceId?: string;
}

export function getGuestSpeechRuntime(): GuestSpeechRuntime | null {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    return null;
  }

  return {
    synthesis: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
  };
}

function voiceId(voice: SpeechSynthesisVoice) {
  return voice.voiceURI || `${voice.name}|${voice.lang}`;
}

function preferredFallbackVoice(voices: SpeechSynthesisVoice[], role: GuestVoiceRole) {
  const preferredName = role === "guest" ? "david" : "zira";
  return (
    voices.find((voice) => voice.name.toLowerCase().includes(preferredName)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-us")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

/** English system voices exposed by the current browser/device. */
export function getGuestVoiceOptions(runtime: GuestSpeechRuntime | null): GuestVoiceOption[] {
  if (!runtime) return [];
  return runtime.synthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .map((voice) => ({ id: voiceId(voice), label: `${voice.name} (${voice.lang})` }));
}

/** Speak only text that has already been validated by the caller. */
export function speakGuestLine(
  text: string,
  runtime: GuestSpeechRuntime | null = getGuestSpeechRuntime(),
  options: GuestSpeechOptions = {},
): boolean {
  const line = text.trim();
  if (!line || !runtime) return false;

  try {
    // The Guest never talks over itself when scenes or answers change.
    runtime.synthesis.cancel();
    const utterance = new runtime.Utterance(line);
    const role = options.role ?? "guest";
    utterance.lang = "en-US";
    utterance.rate = role === "mom" ? 0.96 : role === "mom_impostor" ? 0.9 : 0.88;
    utterance.pitch = role === "mom" ? 1 : role === "mom_impostor" ? 0.84 : 0.62;
    utterance.volume = role === "guest" ? 0.82 : 0.9;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      options.onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    const voices = runtime.synthesis.getVoices();
    utterance.voice =
      (options.voiceId ? voices.find((voice) => voiceId(voice) === options.voiceId) : undefined) ??
      preferredFallbackVoice(voices, role);

    runtime.synthesis.speak(utterance);
    return true;
  } catch {
    // Voice is optional; the visible subtitle remains the safe fallback.
    return false;
  }
}

export function cancelGuestSpeech(runtime: GuestSpeechRuntime | null = getGuestSpeechRuntime()) {
  try {
    runtime?.synthesis.cancel();
  } catch {
    // Some browsers expose the API but disable it at runtime.
  }
}
