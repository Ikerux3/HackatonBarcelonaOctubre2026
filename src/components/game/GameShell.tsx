import { useEffect, useState, type ReactNode } from "react";

import { ArtFilters } from "./CorruptionLayer";
import { GuestVoiceControl, GuestVoiceProvider } from "./GuestVoice";

/**
 * Phone "app shell" for the game route: a fixed box that always matches the
 * VISIBLE area (it shrinks when the keyboard opens), so the page never scrolls,
 * bounces or shows a scrollbar. Exposes --app-h / --app-top for layouts.
 * Only active while the game is mounted (/editor keeps normal page scrolling).
 */
export function GameShell({ children }: { children: ReactNode }) {
  const [rotate, setRotate] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("game-shell-root");
    const vv = window.visualViewport;
    const coarse = window.matchMedia("(pointer: coarse)");

    const update = () => {
      root.style.setProperty("--app-h", `${Math.round(vv?.height ?? window.innerHeight)}px`);
      root.style.setProperty("--app-top", `${Math.round(vv?.offsetTop ?? 0)}px`);
      // ask to rotate only for a phone really held sideways — not when the
      // keyboard makes the visible area wider than tall
      const typing = document.activeElement?.tagName === "INPUT";
      const type = window.screen.orientation?.type;
      const wide = window.innerWidth > window.innerHeight;
      const landscape = !typing && wide && (type ? type.startsWith("landscape") : true);
      // phones only (short side < 600px); iOS reports screen size in portrait terms
      const phone = Math.min(window.screen.width, window.screen.height) < 600;
      setRotate(coarse.matches && landscape && phone);
    };

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("focusout", update);
    window.screen.orientation?.addEventListener?.("change", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("focusout", update);
      window.screen.orientation?.removeEventListener?.("change", update);
      root.classList.remove("game-shell-root");
      root.style.removeProperty("--app-h");
      root.style.removeProperty("--app-top");
    };
  }, []);

  return (
    <div className="game-shell">
      <GuestVoiceProvider>
        <ArtFilters />
        {children}
        <GuestVoiceControl />
        {rotate && (
          <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-neutral-950 px-8 text-center font-serif text-neutral-200">
            <span className="text-5xl" aria-hidden>
              📱
            </span>
            <p className="text-lg italic">Turn your phone upright.</p>
            <p className="text-sm text-neutral-500">It's watching from the other side.</p>
          </div>
        )}
      </GuestVoiceProvider>
    </div>
  );
}
