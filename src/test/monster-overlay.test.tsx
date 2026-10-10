import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestVoiceProvider } from "@/components/game/GuestVoice";
import { MonsterOverlay } from "@/components/game/MonsterOverlay";

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
  beforeEach(() => {
    vi.useFakeTimers();
    BrowserUtterance.instances = [];
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
        getVoices: () => [],
        removeEventListener: vi.fn(),
        speak: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not reveal the next scene until the spoken line has ended", () => {
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

    act(() => vi.advanceTimersByTime(3_200));
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
});
