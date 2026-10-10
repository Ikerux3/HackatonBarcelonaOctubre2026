import { CORDURA_RULES } from "@/game/cordura";

/** HUD of the Barra de Cordura: higher = the child is more shaken (team convention). */
export function CorduraMeter({ value }: { value: number }) {
  const high = value >= CORDURA_RULES.cryingFrom;
  return (
    <div
      role="meter"
      aria-label="Cordura"
      aria-valuemin={0}
      aria-valuemax={CORDURA_RULES.max}
      aria-valuenow={value}
      className="mb-2 flex h-4 w-full items-center gap-2 px-1"
    >
      <span className="font-display-sc text-xs leading-none tracking-[0.2em] text-[#f4e6c8]">
        Cordura
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/15">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-500 ${
            high ? "bg-red-600" : "bg-amber-400"
          }`}
          style={{ width: `${(value / CORDURA_RULES.max) * 100}%` }}
        />
      </div>
      <span className="w-6 text-right font-mono text-xs leading-none tabular-nums text-[#f4e6c8]">
        {value}
      </span>
    </div>
  );
}
