import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Volume2, VolumeX } from "lucide-react";

import {
  cancelGuestSpeech,
  getGuestSpeechRuntime,
  GUEST_VOICE_MUTED_KEY,
  speakGuestLine,
} from "@/game/guestVoice";

interface GuestVoiceContextValue {
  cancel: () => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  speak: (line: string) => void;
  supported: boolean;
}

const GuestVoiceContext = createContext<GuestVoiceContextValue | null>(null);

export function GuestVoiceProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(getGuestSpeechRuntime() !== null);
    try {
      setMutedState(localStorage.getItem(GUEST_VOICE_MUTED_KEY) === "true");
    } catch {
      // Storage is optional too (private mode and hardened browsers can block it).
    }
  }, []);

  const cancel = useCallback(() => cancelGuestSpeech(), []);
  const speak = useCallback(
    (line: string) => {
      if (!muted && supported) speakGuestLine(line);
    },
    [muted, supported],
  );
  const setMuted = useCallback(
    (nextMuted: boolean) => {
      setMutedState(nextMuted);
      if (nextMuted) cancel();
      try {
        localStorage.setItem(GUEST_VOICE_MUTED_KEY, String(nextMuted));
      } catch {
        // The setting simply lasts for this session when storage is unavailable.
      }
    },
    [cancel],
  );

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    window.addEventListener("pagehide", cancel);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.removeEventListener("pagehide", cancel);
      document.removeEventListener("visibilitychange", stopWhenHidden);
      cancel();
    };
  }, [cancel]);

  const value = useMemo(
    () => ({ cancel, muted, setMuted, speak, supported }),
    [cancel, muted, setMuted, speak, supported],
  );

  return <GuestVoiceContext.Provider value={value}>{children}</GuestVoiceContext.Provider>;
}

function useGuestVoiceContext() {
  const context = useContext(GuestVoiceContext);
  if (!context) throw new Error("Guest voice must be used inside GameShell");
  return context;
}

/** Cancels pending speech whenever the line or scene is replaced. */
// eslint-disable-next-line react-refresh/only-export-components
export function useGuestVoice(line?: string | null, active = true, delayMs = 0) {
  const { cancel, speak } = useGuestVoiceContext();

  useEffect(() => {
    if (!active || !line) {
      cancel();
      return;
    }

    const timer = window.setTimeout(() => speak(line), delayMs);
    return () => {
      window.clearTimeout(timer);
      cancel();
    };
  }, [active, cancel, delayMs, line, speak]);
}

export function GuestVoiceControl() {
  const { muted, setMuted, supported } = useGuestVoiceContext();
  const label = supported
    ? muted
      ? "Turn on Guest voice"
      : "Mute Guest voice"
    : "Guest voice unavailable; subtitles remain on";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={supported && !muted}
      disabled={!supported}
      title={label}
      onClick={() => setMuted(!muted)}
      className="absolute right-2 top-2 z-[190] flex h-11 w-11 items-center justify-center rounded-full border border-neutral-400/35 bg-black/55 text-neutral-100 shadow-md backdrop-blur-sm transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {supported && !muted ? (
        <Volume2 className="h-5 w-5" aria-hidden />
      ) : (
        <VolumeX className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
