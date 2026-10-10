import type { SceneTheme } from "@/game/levels/types";

/**
 * Purely decorative room art behind a minigame. Never interactive.
 * Layered like a diorama: wall → wainscot → floor → furniture → light pools →
 * grain/vignette. Furniture keeps the same footprint as before so hotspots
 * authored on top of it still line up. `dark` = same room, moonlit and drained.
 */
export function SceneBackdrop({ theme, dark }: { theme: SceneTheme; dark: boolean }) {
  const wall =
    theme === "bedroom"
      ? "g-wallpaper-bedroom"
      : theme === "dining_room"
        ? "g-wallpaper-dining"
        : "g-wallpaper";
  return (
    <div className="g-corruptible pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* wall */}
      <div className={`absolute inset-x-0 top-0 h-[62%] ${wall}`} />
      {/* ceiling shadow + cornice */}
      <div className="absolute inset-x-0 top-0 h-[7%] bg-gradient-to-b from-black/45 to-transparent" />
      {/* wainscot strip */}
      <div className="g-wainscot absolute inset-x-0 top-[50%] h-[12%]" />
      {/* floor */}
      <div className="g-floor absolute inset-x-0 bottom-0 h-[38%]" />
      {/* baseboard line */}
      <div className="absolute inset-x-0 top-[61.5%] h-[1.2%] bg-[#3a1f0d]" />

      {theme === "living_room" && (
        <>
          {/* arched window, night outside with curtains */}
          <div className="absolute left-[6%] top-[5%] h-[19%] w-[20%]">
            <div className="absolute inset-0 overflow-hidden rounded-t-full border-[5px] border-[#6b3e1e] bg-gradient-to-b from-[#1b2340] to-[#3b4a72] shadow-[inset_0_0_14px_rgba(0,0,0,0.6)]">
              <div className="absolute right-[22%] top-[22%] h-3 w-3 rounded-full bg-[#fff3d0] shadow-[0_0_10px_rgba(255,240,200,0.8)]" />
              <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#6b3e1e]" />
              <div className="absolute inset-x-0 top-1/2 h-[3px] bg-[#6b3e1e]" />
            </div>
            <div className="absolute -left-[14%] -top-[6%] h-[112%] w-[30%] rounded-b-[40%] bg-gradient-to-r from-[#7a2a26] to-[#a5463c] shadow-md" />
            <div className="absolute -right-[14%] -top-[6%] h-[112%] w-[30%] rounded-b-[40%] bg-gradient-to-l from-[#7a2a26] to-[#a5463c] shadow-md" />
          </div>
          {/* hanging lamp */}
          <div className="absolute right-[10%] top-0 flex flex-col items-center">
            <div className="h-[6vh] max-h-14 w-[2px] bg-[#2a170b]" />
            <div
              className={`h-8 w-14 rounded-b-full border-b-4 border-[#7a4a26] ${dark ? "bg-[#4a3a2a]" : "game-lamp-glow bg-gradient-to-b from-[#ffe7a6] to-[#f2b54a]"}`}
            />
          </div>
          {/* framed picture */}
          <div className="absolute left-[34%] top-[18%] h-[20%] w-[30%] rounded-sm border-[6px] border-[#8a5a2b] bg-gradient-to-br from-[#f1e2bf] to-[#d8c08f] shadow-[0_8px_14px_-6px_rgba(0,0,0,0.6),inset_0_0_10px_rgba(90,50,20,0.35)]">
            {/* simple house drawing */}
            <div className="absolute bottom-[18%] left-1/2 h-[38%] w-[36%] -translate-x-1/2 bg-[#b6533f]/80" />
            <div
              className="absolute bottom-[56%] left-1/2 h-[26%] w-[48%] -translate-x-1/2 bg-[#5a3a2a]/80"
              style={{ clipPath: "polygon(50% 0,100% 100%,0 100%)" }}
            />
            <div className="absolute bottom-[26%] left-[46%] h-[14%] w-[10%] bg-[#ffd27a]" />
          </div>
          {/* rug */}
          <div className="g-rug absolute left-[14%] top-[70%] h-[16%] w-[72%] rounded-[50%]" />
          {!dark && (
            <>
              <div className="g-light-pool right-[-6%] top-[2%] h-[46%] w-[46%]" />
              <div className="g-light-pool left-[20%] top-[58%] h-[40%] w-[60%] opacity-70" />
            </>
          )}
        </>
      )}

      {theme === "bedroom" && (
        <>
          {/* window with moon */}
          <div className="absolute left-[10%] top-[6%] h-[18%] w-[26%] overflow-hidden rounded-md border-[5px] border-[#c9b892] bg-gradient-to-b from-[#0d1330] to-[#1f2b55] shadow-[inset_0_0_16px_rgba(0,0,0,0.7)]">
            <div className="absolute right-[16%] top-[16%] h-5 w-5 rounded-full bg-[#fff6dc] shadow-[0_0_16px_rgba(255,250,220,0.85)]" />
            <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#c9b892]" />
          </div>
          {/* moonbeam */}
          <div
            className="absolute left-[10%] top-[24%] h-[60%] w-[40%] bg-gradient-to-b from-[#bcd0ff]/20 to-transparent"
            style={{ clipPath: "polygon(0 0,65% 0,100% 100%,30% 100%)" }}
          />
          {/* wardrobe */}
          <div className="absolute right-[6%] top-[8%] h-[46%] w-[24%] rounded-t-lg border-4 border-[#3a1f0d] bg-gradient-to-b from-[#7a4a26] to-[#55301a] shadow-[0_12px_18px_-8px_rgba(0,0,0,0.7)]">
            <div className="absolute inset-y-2 left-1/2 w-[2px] bg-black/50" />
            <div className="absolute left-[38%] top-1/2 h-2 w-1 rounded bg-[#e7c77a]" />
            <div className="absolute right-[38%] top-1/2 h-2 w-1 rounded bg-[#e7c77a]" />
            {/* the door is open a crack: darkness inside */}
            <div className="absolute inset-y-2 left-1/2 w-[6%] bg-black" />
          </div>
          {/* bed */}
          <div className="absolute left-[2%] top-[38%] h-[34%] w-[4%] rounded-t-md bg-gradient-to-b from-[#6b3e1e] to-[#3a1f0d]" />
          <div className="absolute left-[4%] top-[48%] h-[22%] w-[62%] rounded-xl bg-gradient-to-b from-[#7fa6d8] to-[#4a6fa5] shadow-[0_12px_14px_-6px_rgba(0,0,0,0.6)]">
            <div className="absolute inset-x-0 top-[38%] h-[2px] bg-white/30" />
          </div>
          <div className="absolute left-[6%] top-[44%] h-[8%] w-[18%] rounded-lg bg-gradient-to-b from-[#fffaf0] to-[#e4dccb] shadow" />
          {/* under the bed: deepest shadow in the room */}
          <div className="absolute left-[4%] top-[70%] h-[5%] w-[62%] rounded-b-xl bg-black/70 blur-[2px]" />
          {/* nightstand + small lamp */}
          <div className="absolute right-[22%] top-[60%] h-[12%] w-[14%] rounded bg-gradient-to-b from-[#8a5a2b] to-[#5a3416] shadow-md" />
          {/* rug */}
          <div className="g-rug absolute left-[20%] top-[80%] h-[10%] w-[56%] rounded-[50%] opacity-80" />
        </>
      )}

      {theme === "dining_room" && (
        <>
          <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
            <div className="h-5 w-[2px] bg-[#2a170b]" />
            <div
              className={`h-6 w-16 rounded-t-full border-b-4 border-[#7a4a26] ${dark ? "bg-[#4a3a2a]" : "game-lamp-glow bg-gradient-to-b from-[#ffe7a6] to-[#f2b54a]"}`}
            />
          </div>
          {/* tabletop with cloth */}
          <div className="absolute left-[6%] right-[6%] top-[22%] h-[44%] rounded-[2rem] border-4 border-[#4a2a14] bg-gradient-to-b from-[#9a6233] to-[#6e4223] shadow-[0_20px_26px_-10px_rgba(0,0,0,0.75)]">
            <div className="absolute inset-[7%] rounded-[1.4rem] bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_8px,transparent_8px_16px)] bg-[#e9dcc0] shadow-[inset_0_0_14px_rgba(90,50,20,0.35)]" />
          </div>
          {/* tray where items start */}
          <div className="absolute left-[3%] right-[3%] top-[74%] h-[20%] rounded-2xl border-2 border-[#4a2a14]/60 bg-gradient-to-b from-[#c79a5d]/70 to-[#a5763f]/70 shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)]" />
          {!dark && <div className="g-light-pool left-[15%] top-[10%] h-[60%] w-[70%]" />}
        </>
      )}

      {/* lighting & finish */}
      {dark && <div className="g-room-dark-tint" />}
      <div className={dark ? "g-vignette-dark" : "g-vignette"} />
      <div className={dark ? "g-grain-dark" : "g-grain"} />
    </div>
  );
}
