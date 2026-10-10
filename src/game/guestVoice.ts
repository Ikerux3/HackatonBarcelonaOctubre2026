export const GUEST_VOICE_MUTED_KEY = "mommy-will-be-back:guest-voice-muted";
export const GUEST_VOICE_ID_KEY = "mommy-will-be-back:guest-voice-id";
export const GUEST_VOICE_PREVIEW_LINE = "Can you hear me, sweetie?";

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
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    utterance.pitch = 0.62;
    utterance.volume = 0.82;

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
      voices.find((voice) => voiceId(voice) === options.voiceId) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en-us")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
      null;

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
