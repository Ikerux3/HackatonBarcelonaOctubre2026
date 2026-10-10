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
  ELEVENLABS_VOICE_ID,
  getGuestVoiceOptions,
  getGuestSpeechRuntime,
  GUEST_VOICE_ID_KEY,
  GUEST_VOICE_MUTED_KEY,
  GUEST_VOICE_PREVIEW_LINE,
  speakGuestLine,
  type GuestVoiceOption,
} from "@/game/guestVoice";
import { synthesizeGuestVoice, type GuestVoiceRole } from "@/game/guestVoice.functions";

interface GuestVoiceContextValue {
  cancel: () => void;
  muted: boolean;
  ready: boolean;
  setMuted: (muted: boolean) => void;
  setVoiceId: (voiceId: string) => void;
  speak: (line: string, onEnd?: () => void, role?: GuestVoiceRole) => boolean;
  supported: boolean;
  voiceId: string;
  voices: GuestVoiceOption[];
}

const GuestVoiceContext = createContext<GuestVoiceContextValue | null>(null);

export function GuestVoiceProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(false);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voiceId, setVoiceIdState] = useState(ELEVENLABS_VOICE_ID);
  const [voices, setVoices] = useState<GuestVoiceOption[]>([]);
  const voiceIdRef = useRef(ELEVENLABS_VOICE_ID);
  const remoteAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const runtime = getGuestSpeechRuntime();
    setSupported(runtime !== null || typeof Audio !== "undefined");
    const refreshVoices = () => setVoices(getGuestVoiceOptions(runtime));
    refreshVoices();
    runtime?.synthesis.addEventListener?.("voiceschanged", refreshVoices);
    try {
      setMutedState(localStorage.getItem(GUEST_VOICE_MUTED_KEY) === "true");
      const storedVoiceId = localStorage.getItem(GUEST_VOICE_ID_KEY) ?? ELEVENLABS_VOICE_ID;
      voiceIdRef.current = storedVoiceId;
      setVoiceIdState(storedVoiceId);
    } catch {
      // Storage is optional too (private mode and hardened browsers can block it).
    }
    setReady(true);
    return () => runtime?.synthesis.removeEventListener?.("voiceschanged", refreshVoices);
  }, []);

  const stopRemoteAudio = useCallback(() => {
    const active = remoteAudioRef.current;
    remoteAudioRef.current = null;
    if (!active) return;
    active.audio.onended = null;
    active.audio.onerror = null;
    active.audio.pause();
    URL.revokeObjectURL(active.url);
  }, []);
  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    stopRemoteAudio();
    cancelGuestSpeech();
  }, [stopRemoteAudio]);

  const startSpeech = useCallback(
    (line: string, selectedVoiceId: string, onEnd?: () => void, role: GuestVoiceRole = "guest") => {
      const text = line.trim();
      if (!text) return false;
      cancel();
      const requestId = requestIdRef.current;
      let finished = false;
      const finish = () => {
        if (finished || requestId !== requestIdRef.current) return;
        finished = true;
        stopRemoteAudio();
        onEnd?.();
      };
      const browserFallback = () => {
        if (finished || requestId !== requestIdRef.current) return;
        stopRemoteAudio();
        const started = speakGuestLine(text, undefined, {
          onEnd: finish,
          voiceId: selectedVoiceId === ELEVENLABS_VOICE_ID ? "" : selectedVoiceId,
        });
        if (!started) finish();
      };

      if (selectedVoiceId !== ELEVENLABS_VOICE_ID) {
        browserFallback();
        return true;
      }

      void synthesizeGuestVoice({ data: { role, text } })
        .then((result) => {
          if (finished || requestId !== requestIdRef.current) return;
          if (!result.available || typeof Audio === "undefined") {
            browserFallback();
            return;
          }
          const binary = atob(result.audioBase64);
          const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
          const audio = new Audio(url);
          if (role === "mom_impostor") audio.playbackRate = 0.96;
          audio.onended = finish;
          audio.onerror = browserFallback;
          remoteAudioRef.current = { audio, url };
          void audio.play().catch(browserFallback);
        })
        .catch(browserFallback);
      return true;
    },
    [cancel, stopRemoteAudio],
  );

  const speak = useCallback(
    (line: string, onEnd?: () => void, role: GuestVoiceRole = "guest") => {
      if (!muted && supported) return startSpeech(line, voiceIdRef.current, onEnd, role);
      return false;
    },
    [muted, startSpeech, supported],
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
      startSpeech(GUEST_VOICE_PREVIEW_LINE, nextVoiceId);
      try {
        localStorage.setItem(GUEST_VOICE_ID_KEY, nextVoiceId);
      } catch {
        // The setting simply lasts for this session when storage is unavailable.
      }
    },
    [cancel, startSpeech],
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
  role: GuestVoiceRole = "guest",
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
      const started = speak(line, () => onFinishedRef.current?.(), role);
      if (!started) onFinishedRef.current?.();
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancel();
    };
  }, [active, cancel, delayMs, line, ready, role, speak]);
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
            value={
              voiceId === ELEVENLABS_VOICE_ID || voices.some((voice) => voice.id === voiceId)
                ? voiceId
                : ELEVENLABS_VOICE_ID
            }
            disabled={muted}
            onChange={(event) => setVoiceId(event.target.value)}
            className="max-w-36 bg-transparent text-xs text-neutral-100 outline-none disabled:opacity-50"
          >
            <option value={ELEVENLABS_VOICE_ID} className="bg-neutral-950">
              ElevenLabs voice
            </option>
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
