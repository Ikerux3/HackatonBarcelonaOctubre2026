import { describe, expect, it, vi } from "vitest";

import {
  cancelGuestSpeech,
  getGuestVoiceOptions,
  speakGuestLine,
  type GuestSpeechRuntime,
} from "@/game/guestVoice";

class FakeUtterance {
  lang = "";
  pitch = 1;
  rate = 1;
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function runtime(voices: SpeechSynthesisVoice[] = []) {
  const cancel = vi.fn();
  const speak = vi.fn();
  return {
    cancel,
    speak,
    value: {
      synthesis: { cancel, getVoices: () => voices, speak },
      Utterance: FakeUtterance,
    } as unknown as GuestSpeechRuntime,
  };
}

describe("Guest voice", () => {
  it("cancels an old line and configures a quiet English voice before speaking", () => {
    const english = { lang: "en-GB" } as SpeechSynthesisVoice;
    const speech = runtime([{ lang: "es-ES" } as SpeechSynthesisVoice, english]);

    expect(speakGuestLine("  Come closer.  ", speech.value)).toBe(true);
    expect(speech.cancel).toHaveBeenCalledOnce();
    expect(speech.speak).toHaveBeenCalledOnce();

    const utterance = speech.speak.mock.calls[0]?.[0] as unknown as FakeUtterance;
    expect(utterance.text).toBe("Come closer.");
    expect(utterance.voice).toBe(english);
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBeLessThan(1);
    expect(utterance.pitch).toBeLessThan(1);
  });

  it("keeps subtitles as the fallback when speech is unavailable or empty", () => {
    expect(speakGuestLine("Still visible.", null)).toBe(false);
    expect(speakGuestLine("   ", runtime().value)).toBe(false);
  });

  it("waits for the browser speech completion event and honors a selected voice", () => {
    const onEnd = vi.fn();
    const selected = {
      lang: "en-US",
      name: "Night Voice",
      voiceURI: "night-voice",
    } as SpeechSynthesisVoice;
    const speech = runtime([selected]);

    expect(speakGuestLine("Stay a while.", speech.value, { voiceId: "night-voice", onEnd })).toBe(
      true,
    );
    const utterance = speech.speak.mock.calls[0]?.[0] as unknown as FakeUtterance;
    expect(utterance.voice).toBe(selected);
    expect(onEnd).not.toHaveBeenCalled();

    utterance.onend?.();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("lists only the English voices available on the device", () => {
    const english = {
      lang: "en-GB",
      name: "Whisper",
      voiceURI: "whisper",
    } as SpeechSynthesisVoice;
    const spanish = {
      lang: "es-ES",
      name: "Española",
      voiceURI: "spanish",
    } as SpeechSynthesisVoice;

    expect(getGuestVoiceOptions(runtime([spanish, english]).value)).toEqual([
      { id: "whisper", label: "Whisper (en-GB)" },
    ]);
  });

  it("cancels safely on scene transitions", () => {
    const speech = runtime();
    cancelGuestSpeech(speech.value);
    expect(speech.cancel).toHaveBeenCalledOnce();
  });
});
