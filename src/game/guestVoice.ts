export const GUEST_VOICE_MUTED_KEY = "mommy-will-be-back:guest-voice-muted";

export interface GuestSpeechRuntime {
  synthesis: Pick<SpeechSynthesis, "cancel" | "getVoices" | "speak">;
  Utterance: new (text: string) => SpeechSynthesisUtterance;
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

/** Speak only text that has already been validated by the caller. */
export function speakGuestLine(
  text: string,
  runtime: GuestSpeechRuntime | null = getGuestSpeechRuntime(),
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

    const voices = runtime.synthesis.getVoices();
    utterance.voice =
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
