import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Volume2, VolumeX } from "lucide-react";

import {
  cancelGuestSpeech,
  getGuestVoiceOptions,
  getGuestSpeechRuntime,
  GUEST_VOICE_ID_KEY,
  GUEST_VOICE_MUTED_KEY,
  GUEST_VOICE_PREVIEW_LINE,
  speakGuestLine,
  type GuestVoiceOption,
} from "@/game/guestVoice";

interface GuestVoiceContextValue {
  cancel: () => void;
  muted: boolean;
  ready: boolean;
  setMuted: (muted: boolean) => void;
  setVoiceId: (voiceId: string) => void;
  speak: (line: string, onEnd?: () => void) => boolean;
  supported: boolean;
  voiceId: string;
  voices: GuestVoiceOption[];
}

const GuestVoiceContext = createContext<GuestVoiceContextValue | null>(null);

export function GuestVoiceProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(false);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voiceId, setVoiceIdState] = useState("");
  const [voices, setVoices] = useState<GuestVoiceOption[]>([]);
  const voiceIdRef = useRef("");

  useEffect(() => {
    const runtime = getGuestSpeechRuntime();
    setSupported(runtime !== null);
    const refreshVoices = () => setVoices(getGuestVoiceOptions(runtime));
    refreshVoices();
    runtime?.synthesis.addEventListener?.("voiceschanged", refreshVoices);
    try {
      setMutedState(localStorage.getItem(GUEST_VOICE_MUTED_KEY) === "true");
      const storedVoiceId = localStorage.getItem(GUEST_VOICE_ID_KEY) ?? "";
      voiceIdRef.current = storedVoiceId;
      setVoiceIdState(storedVoiceId);
    } catch {
      // Storage is optional too (private mode and hardened browsers can block it).
    }
    setReady(true);
    return () => runtime?.synthesis.removeEventListener?.("voiceschanged", refreshVoices);
  }, []);

  const cancel = useCallback(() => cancelGuestSpeech(), []);
  const speak = useCallback(
    (line: string, onEnd?: () => void) => {
      if (!muted && supported)
        return speakGuestLine(line, undefined, {
          ...(onEnd ? { onEnd } : {}),
          voiceId: voiceIdRef.current,
        });
      return false;
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
  const setVoiceId = useCallback(
    (nextVoiceId: string) => {
      cancel();
      voiceIdRef.current = nextVoiceId;
      setVoiceIdState(nextVoiceId);
      speakGuestLine(GUEST_VOICE_PREVIEW_LINE, undefined, { voiceId: nextVoiceId });
      try {
        localStorage.setItem(GUEST_VOICE_ID_KEY, nextVoiceId);
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
    () => ({ cancel, muted, ready, setMuted, setVoiceId, speak, supported, voiceId, voices }),
    [cancel, muted, ready, setMuted, setVoiceId, speak, supported, voiceId, voices],
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
export function useGuestVoice(
  line?: string | null,
  active = true,
  delayMs = 0,
  onFinished?: () => void,
) {
  const { cancel, ready, speak } = useGuestVoiceContext();
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!active || !line || !ready) {
      cancel();
      return;
    }

    const timer = window.setTimeout(() => {
      const started = speak(line, () => onFinishedRef.current?.());
      if (!started) onFinishedRef.current?.();
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancel();
    };
  }, [active, cancel, delayMs, line, ready, speak]);
}

export function GuestVoiceControl() {
  const { muted, setMuted, setVoiceId, supported, voiceId, voices } = useGuestVoiceContext();
  const label = supported
    ? muted
      ? "Turn on Guest voice"
      : "Mute Guest voice"
    : "Guest voice unavailable; subtitles remain on";

  return (
    <div className="absolute right-2 top-2 z-[190] flex items-center gap-2">
      {supported && voices.length > 0 && (
        <label className="rounded-full border border-neutral-400/35 bg-black/55 px-2 py-1 text-neutral-100 shadow-md backdrop-blur-sm">
          <span className="sr-only">Guest voice</span>
          <select
            aria-label="Guest voice"
            value={voices.some((voice) => voice.id === voiceId) ? voiceId : ""}
            disabled={muted}
            onChange={(event) => setVoiceId(event.target.value)}
            className="max-w-36 bg-transparent text-xs text-neutral-100 outline-none disabled:opacity-50"
          >
            <option value="" className="bg-neutral-950">
              Automatic voice
            </option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id} className="bg-neutral-950">
                {voice.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        aria-label={label}
        aria-pressed={supported && !muted}
        disabled={!supported}
        title={label}
        onClick={() => setMuted(!muted)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-400/35 bg-black/55 text-neutral-100 shadow-md backdrop-blur-sm transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {supported && !muted ? (
          <Volume2 className="h-5 w-5" aria-hidden />
        ) : (
          <VolumeX className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
