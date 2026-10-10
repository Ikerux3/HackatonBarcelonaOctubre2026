import { useEffect, useMemo, useState } from "react";
import { COLOR_HEX } from "@/game/levels/assets";
import { useCorduraLight } from "@/game/cordura";
import type { MinigameProps } from "./types";

const GARMENTS = [
  { kind: "shirt", icon: "👕", label: "Shirt" },
  { kind: "pants", icon: "👖", label: "Pants" },
  { kind: "socks", icon: "🧦", label: "Socks" },
] as const;
const PALETTE = ["red", "blue", "green", "purple"] as const;
type Garment = { id: string; kind: (typeof GARMENTS)[number]["kind"]; icon: string; label: string; color: keyof typeof COLOR_HEX };
const colorName = (value: string) => value === "other" ? "blue" : value;

/** Bedtime's three-piece outfit: select the matching set, then tidy the laundry. */
export function PajamaMinigame({ memory, onComplete }: MinigameProps) {
  const favorite = colorName(memory.favoriteColor ?? "blue") as keyof typeof COLOR_HEX;
  const pile = useMemo<Garment[]>(() => {
    const colors = [favorite, ...PALETTE.filter((c) => c !== favorite)].slice(0, 4);
    const all = GARMENTS.flatMap((g) => colors.map((color) => ({
      id: g.kind + "-" + color, kind: g.kind, icon: g.icon, label: g.label, color,
    })));
    // Fixed order provides a reproducible puzzle; correct pieces are scattered.
    return all.sort((a, b) => (a.id.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 17) -
      (b.id.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 17));
  }, [favorite]);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [discarded, setDiscarded] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("Find a shirt, pants and socks in your favorite color.");
  const allEquipped = GARMENTS.every((g) => equipped.includes(g.kind + "-" + favorite));
  const extras = pile.filter((g) => g.color !== favorite);
  const allTidied = extras.every((g) => discarded.includes(g.id));

  useCorduraLight("lit");
  useEffect(() => {
    if (allEquipped && allTidied) onComplete?.();
  }, [allEquipped, allTidied, onComplete]);

  function choose(item: Garment) {
    if (item.color !== favorite) {
      setFeedback("That color isn't yours. Remember what you told the house.");
      return;
    }
    if (equipped.includes(item.id)) return;
    setEquipped((prev) => [...prev, item.id]);
    setFeedback("That fits. Keep looking for the rest of the set.");
  }
  function tidy(item: Garment) {
    if (item.color === favorite) {
      setFeedback("Keep your own pajamas! The basket is for the other clothes.");
      return;
    }
    setDiscarded((prev) => prev.includes(item.id) ? prev : [...prev, item.id]);
    setFeedback("Put away. Check the rest of the laundry.");
  }

  return (
    <div className="relative flex min-h-[390px] w-full flex-col gap-3 overflow-hidden rounded-2xl border-2 border-amber-900 bg-stone-900 p-3 text-amber-50">
      <div className="flex items-center justify-between gap-2">
        <div><p className="font-serif text-lg font-bold">Get ready for bed</p>
          <p className="text-sm">Find 3 matching pajama pieces, then clear the laundry.</p></div>
        <div className="rounded-xl border border-amber-300/40 bg-black p-2 text-center">
          <div className="text-xs">Your color</div>
          <div className="mx-auto mt-1 h-6 w-8 rounded-md border-2 border-white" style={{ backgroundColor: COLOR_HEX[favorite] }} />
        </div>
      </div>
      <div className="relative rounded-lg border-2 border-amber-700 bg-stone-800 px-3 py-2">
        <span aria-hidden className="absolute right-3 top-2 text-lg text-red-400 opacity-70 motion-safe:animate-pulse">👁️ 👁️</span>
        <span className="font-serif text-sm">Mirror: it almost looks like someone's watching.</span>
      </div>
      <div aria-live="polite" className="min-h-8 text-sm italic text-amber-200">{feedback}</div>
      <div className="grid grid-cols-3 gap-2">
        {pile.map((item) => {
          const worn = equipped.includes(item.id);
          const away = discarded.includes(item.id);
          return (
            <button key={item.id} type="button" disabled={worn || away}
              onClick={() => allEquipped ? tidy(item) : choose(item)}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-amber-400/50 bg-stone-700 p-1 text-xs disabled:opacity-35"
              aria-label={item.color + " " + item.label + (worn ? " worn" : away ? " in basket" : "")}>
              <span aria-hidden className="text-2xl" style={{ filter: item.color === "blue" ? "none" : undefined }}>{item.icon}</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full border border-white/75" style={{ backgroundColor: COLOR_HEX[item.color] }} />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-black/50 px-3 py-2 text-sm">
        <span>Pajamas: {equipped.length}/3</span>
        <span>🧺 Basket: {discarded.length}/{extras.length}</span>
      </div>
      {allEquipped && <p className="text-center text-sm font-medium">Your pajamas are on. Put all other clothes in the basket.</p>}
    </div>
  );
}
