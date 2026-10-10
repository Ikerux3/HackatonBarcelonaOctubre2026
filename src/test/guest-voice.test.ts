import { describe, expect, it, vi } from "vitest";

import {
  cancelGuestSpeech,
  getGuestVoiceOptions,
  isElevenLabsEnabled,
  speakGuestLine,
  spokenLineDurationMs,
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
  it("keeps ElevenLabs disabled unless the server flag is explicitly true", () => {
    expect(isElevenLabsEnabled(undefined)).toBe(false);
    expect(isElevenLabsEnabled("false")).toBe(false);
    expect(isElevenLabsEnabled("1")).toBe(false);
    expect(isElevenLabsEnabled(" TRUE ")).toBe(true);
  });

  it("keeps longer spoken subtitles visible beyond the fixed minimum", () => {
    expect(spokenLineDurationMs("Short line.", 3200)).toBe(3200);
    expect(spokenLineDurationMs("one two three four five six seven eight", 3200)).toBe(4600);
  });

  it("cancels an old line and configures a quiet English voice before speaking", () => {
    const english = { lang: "en-GB", name: "British Voice" } as SpeechSynthesisVoice;
    const speech = runtime([{ lang: "es-ES", name: "Española" } as SpeechSynthesisVoice, english]);

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

  it("uses Microsoft David for The Guest and Microsoft Zira for both mom roles", () => {
    const david = {
      lang: "en-US",
      name: "Microsoft David Desktop",
      voiceURI: "david",
    } as SpeechSynthesisVoice;
    const zira = {
      lang: "en-US",
      name: "Microsoft Zira Desktop",
      voiceURI: "zira",
    } as SpeechSynthesisVoice;
    const speech = runtime([zira, david]);

    speakGuestLine("I can see you.", speech.value, { role: "guest" });
    speakGuestLine("I'll be home soon.", speech.value, { role: "mom" });
    speakGuestLine("Come here.", speech.value, { role: "mom_impostor" });

    const utterances = speech.speak.mock.calls.map((call) => call[0] as unknown as FakeUtterance);
    expect(utterances[0]?.voice).toBe(david);
    expect(utterances[1]?.voice).toBe(zira);
    expect(utterances[2]?.voice).toBe(zira);
    expect(utterances[2]?.pitch).toBeLessThan(utterances[1]?.pitch ?? 0);
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
