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

      {theme === "bedroom" && (
        <>
          {/* window with moon */}
          <div
            className={`absolute left-[10%] top-[6%] h-[18%] w-[26%] rounded-md border-4 ${dark ? "border-neutral-700 bg-neutral-900" : "border-indigo-200 bg-indigo-950"}`}
          >
            <div className="absolute right-[18%] top-[18%] h-5 w-5 rounded-full bg-amber-50 shadow-[0_0_14px_rgba(255,250,220,0.7)]" />
            <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-indigo-200/70" />
          </div>
          {/* wardrobe */}
          <div
            className={`absolute right-[6%] top-[8%] h-[46%] w-[24%] rounded-t-lg border-4 ${dark ? "border-neutral-800 bg-neutral-900" : "border-amber-900 bg-amber-800"}`}
          >
            <div className="absolute inset-y-2 left-1/2 w-0.5 bg-black/40" />
          </div>
          {/* bed */}
          <div
            className={`absolute left-[4%] top-[48%] h-[22%] w-[62%] rounded-xl ${dark ? "bg-neutral-800" : "bg-sky-300"}`}
          />
          <div
            className={`absolute left-[6%] top-[44%] h-[8%] w-[18%] rounded-lg ${dark ? "bg-neutral-700" : "bg-white"}`}
          />
          <div
            className={`absolute left-[2%] top-[38%] h-[34%] w-[4%] rounded-t-md ${dark ? "bg-neutral-800" : "bg-amber-900"}`}
          />
          {/* nightstand */}
          <div
            className={`absolute right-[22%] top-[60%] h-[12%] w-[14%] rounded ${dark ? "bg-neutral-800" : "bg-amber-700"}`}
          />
          {/* rug */}
          <div
            className={`absolute left-[20%] top-[80%] h-[10%] w-[56%] rounded-[50%] ${dark ? "bg-neutral-900" : "bg-rose-300/70"}`}
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
