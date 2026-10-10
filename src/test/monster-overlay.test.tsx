import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestVoiceControl, GuestVoiceProvider } from "@/components/game/GuestVoice";
import { MonsterOverlay } from "@/components/game/MonsterOverlay";

const { synthesizeGuestVoiceMock } = vi.hoisted(() => ({
  synthesizeGuestVoiceMock: vi.fn(),
}));

vi.mock("@/game/guestVoice.functions", () => ({
  synthesizeGuestVoice: synthesizeGuestVoiceMock,
}));

class BrowserUtterance {
  static instances: BrowserUtterance[] = [];
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pitch = 1;
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  volume = 1;

  constructor(public text: string) {
    BrowserUtterance.instances.push(this);
  }
}

describe("timed monster speech", () => {
  let systemVoices: SpeechSynthesisVoice[];

  beforeEach(() => {
    vi.useFakeTimers();
    BrowserUtterance.instances = [];
    systemVoices = [];
    synthesizeGuestVoiceMock.mockReset();
    synthesizeGuestVoiceMock.mockResolvedValue({ available: false });
    localStorage.clear();
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: BrowserUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        cancel: vi.fn(),
        getVoices: () => systemVoices,
        removeEventListener: vi.fn(),
        speak: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not reveal the next scene until the spoken line has ended", async () => {
    const onReadyToAdvance = vi.fn();
    render(
      <GuestVoiceProvider>
        <MonsterOverlay
          line="The lights went out."
          minimumMs={3_200}
          maxWaitMs={12_000}
          onReadyToAdvance={onReadyToAdvance}
        />
      </GuestVoiceProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(3_200);
      await Promise.resolve();
    });
    expect(onReadyToAdvance).not.toHaveBeenCalled();
    expect(BrowserUtterance.instances).toHaveLength(1);

    act(() => BrowserUtterance.instances[0]?.onend?.());
    expect(onReadyToAdvance).toHaveBeenCalledOnce();
  });

  it("uses the safety timeout if a browser never reports speech completion", () => {
    const onReadyToAdvance = vi.fn();
    render(
      <GuestVoiceProvider>
        <MonsterOverlay
          line="The lights went out."
          minimumMs={3_200}
          maxWaitMs={12_000}
          onReadyToAdvance={onReadyToAdvance}
        />
      </GuestVoiceProvider>,
    );

    act(() => vi.advanceTimersByTime(11_999));
    expect(onReadyToAdvance).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onReadyToAdvance).toHaveBeenCalledOnce();
  });

  it("keeps the voice selector hidden while the internal toggle is off", () => {
    render(
      <GuestVoiceProvider>
        <GuestVoiceControl />
      </GuestVoiceProvider>,
    );

    expect(screen.queryByRole("combobox", { name: "Guest voice" })).not.toBeInTheDocument();
  });

  it("falls back to Microsoft David when ElevenLabs is not configured", async () => {
    const david = {
      lang: "en-US",
      name: "Microsoft David Desktop",
      voiceURI: "david",
    } as SpeechSynthesisVoice;
    systemVoices = [david];
    render(
      <GuestVoiceProvider>
        <MonsterOverlay line="Can you hear me, sweetie?" onReadyToAdvance={vi.fn()} />
      </GuestVoiceProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(synthesizeGuestVoiceMock).toHaveBeenCalledWith({
      data: { role: "guest", text: "Can you hear me, sweetie?" },
    });
    expect(BrowserUtterance.instances).toHaveLength(1);
    expect(BrowserUtterance.instances[0]?.text).toBe("Can you hear me, sweetie?");
    expect(BrowserUtterance.instances[0]?.voice).toBe(david);
  });
});
