import type { SceneTheme } from "@/game/levels/types";

/** Purely decorative room art behind a minigame. Never interactive. */
export function SceneBackdrop({ theme, dark }: { theme: SceneTheme; dark: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className={`absolute inset-x-0 top-0 h-[62%] transition-colors duration-1000 ${dark ? "bg-neutral-900" : "bg-amber-100"}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-[38%] transition-colors duration-1000 ${dark ? "bg-neutral-950" : "bg-orange-200"}`}
      />

      {theme === "living_room" && (
        <>
          <div
            className={`absolute left-[8%] top-[6%] h-[16%] w-[16%] rounded-t-full border-4 transition-colors duration-1000 ${
              dark ? "border-neutral-700 bg-neutral-800" : "border-amber-300 bg-sky-200"
            }`}
          >
            {!dark && (
              <div className="absolute inset-0 animate-pulse rounded-t-full bg-yellow-100/60" />
            )}
          </div>
          <div className="absolute right-[10%] top-[6%] flex flex-col items-center">
            <div className={`h-10 w-1 ${dark ? "bg-neutral-700" : "bg-amber-400"}`} />
            <div
              className={`h-8 w-12 rounded-b-full ${dark ? "bg-neutral-700" : "game-lamp-glow bg-yellow-300"}`}
            />
          </div>
          <div
            className={`absolute left-[34%] top-[20%] h-[18%] w-[30%] rounded-md border-4 ${dark ? "border-neutral-800 bg-neutral-900" : "border-amber-700 bg-amber-50"}`}
          />
        </>
      )}

      {theme === "dining_room" && (
        <>
          <div className="absolute left-1/2 top-[3%] flex -translate-x-1/2 flex-col items-center">
            <div className={`h-6 w-0.5 ${dark ? "bg-neutral-700" : "bg-amber-500"}`} />
            <div
              className={`h-6 w-16 rounded-t-full ${dark ? "bg-neutral-700" : "game-lamp-glow bg-yellow-300"}`}
            />
          </div>
          {/* tabletop */}
          <div
            className={`absolute left-[6%] right-[6%] top-[22%] h-[44%] rounded-[2rem] border-4 shadow-xl transition-colors duration-1000 ${
              dark ? "border-neutral-800 bg-neutral-800/80" : "border-amber-800 bg-amber-700"
            }`}
          />
          {/* tray where items start */}
          <div
            className={`absolute left-[3%] right-[3%] top-[74%] h-[20%] rounded-2xl ${dark ? "bg-neutral-900" : "bg-amber-300/60"}`}
          />
        </>
      )}
    </div>
  );
}
