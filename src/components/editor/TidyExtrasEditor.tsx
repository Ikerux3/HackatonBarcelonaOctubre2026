import { TIDY_TOYS } from "@/game/levels/defaultLevels";
import {
  HIDE_SPOT_KINDS,
  type HideSpotKind,
  type LightZone,
  type Point,
  type TidyOptions,
} from "@/game/levels/types";

const input =
  "rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 w-full";
const btn =
  "rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700";

const builtIn = (TIDY_TOYS as { tidy: TidyOptions }).tidy;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      title={label}
      className={`${input} w-16`}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function PointRow({
  name,
  p,
  set,
}: {
  name: string;
  p: Point;
  set: (fn: (p: Point) => void) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-neutral-400">
      <span className="w-20 truncate">{name}</span>
      <Num label={`${name} x`} value={p.x} onChange={(n) => set((q) => (q.x = n))} />
      <Num label={`${name} y`} value={p.y} onChange={(n) => set((q) => (q.y = n))} />
    </div>
  );
}

function ZoneList({
  name,
  zones,
  set,
}: {
  name: string;
  zones: LightZone[];
  set: (fn: (z: LightZone[]) => void) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs text-neutral-400">
      <span>{name} zones (x, y, radius % of width)</span>
      {zones.map((z, i) => (
        <div key={i} className="flex items-center gap-1">
          {(["x", "y", "r"] as const).map((c) => (
            <Num
              key={c}
              label={`${name} zone ${i + 1} ${c}`}
              value={z[c]}
              onChange={(n) => set((zs) => (zs[i]![c] = n))}
            />
          ))}
          <button type="button" className={btn} onClick={() => set((zs) => zs.splice(i, 1))}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${btn} self-start`}
        onClick={() => set((zs) => zs.push({ x: 50, y: 60, r: 20 }))}
      >
        + zone
      </button>
    </div>
  );
}

/** Editor fields for tidy_roles roles "possessed" and "hide_seek". */
export function TidyExtrasEditor({
  tidy,
  setTidy,
}: {
  tidy: TidyOptions;
  setTidy: (fn: (t: TidyOptions) => void) => void;
}) {
  const roles = tidy.steps.map((s) => s.role);
  const P = tidy.possessed;
  const H = tidy.hideSeek;
  const setP = (fn: (p: NonNullable<TidyOptions["possessed"]>) => void) =>
    setTidy((t) => t.possessed && fn(t.possessed));
  const setH = (fn: (h: NonNullable<TidyOptions["hideSeek"]>) => void) =>
    setTidy((t) => t.hideSeek && fn(t.hideSeek));

  return (
    <div className="col-span-2 flex flex-col gap-3">
      {roles.includes("possessed") && !P && (
        <button
          type="button"
          className={`${btn} self-start`}
          onClick={() => setTidy((t) => (t.possessed = clone(builtIn.possessed!)))}
        >
          + Add possessed settings
        </button>
      )}
      {P && (
        <div className="flex flex-col gap-2 rounded border border-neutral-800 p-2">
          <span className="text-xs font-bold uppercase text-neutral-500">
            Possessed toy (purple P1–P4 on preview)
          </span>
          {P.slots.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <PointRow name={`Dark slot ${i + 1}`} p={s} set={(fn) => setP((p) => fn(p.slots[i]!))} />
              {P.slots.length > 3 && (
                <button type="button" className={btn} onClick={() => setP((p) => p.slots.splice(i, 1))}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {P.slots.length < 4 && (
            <button
              type="button"
              className={`${btn} self-start`}
              onClick={() => setP((p) => p.slots.push({ x: 50, y: 70 }))}
            >
              + slot
            </button>
          )}
          <PointRow name="Main switch" p={P.mainSwitch} set={(fn) => setP((p) => fn(p.mainSwitch))} />
          <ZoneList name="Main" zones={P.mainZones} set={(fn) => setP((p) => fn(p.mainZones))} />
          <PointRow name="Lamp" p={P.lamp} set={(fn) => setP((p) => fn(p.lamp))} />
          <ZoneList name="Lamp" zones={P.lampZones} set={(fn) => setP((p) => fn(p.lampZones))} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            {(
              [
                ["maxBlackouts", "Blackouts (1–3)"],
                ["safeWindowMs", "Safe window ms"],
                ["moveMs", "Hop every ms"],
                ["hintAfterMs", "Hint after ms"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1">
                {l}
                <input
                  type="number"
                  aria-label={l}
                  className={`${input} w-20`}
                  value={P[k]}
                  onChange={(e) => setP((p) => (p[k] = Number(e.target.value)))}
                />
              </label>
            ))}
          </div>
          {(
            [
              ["possessLine", "Blackout whisper"],
              ["freezeLine", "Put-away whisper"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-neutral-400">
              {l}
              <input
                className={input}
                maxLength={140}
                value={P[k]}
                onChange={(e) => setP((p) => (p[k] = e.target.value))}
              />
            </label>
          ))}
        </div>
      )}

      {roles.includes("hide_seek") && !H && (
        <button
          type="button"
          className={`${btn} self-start`}
          onClick={() => setTidy((t) => (t.hideSeek = clone(builtIn.hideSeek!)))}
        >
          + Add hide-and-seek settings
        </button>
      )}
      {H && (
        <div className="flex flex-col gap-2 rounded border border-neutral-800 p-2">
          <span className="text-xs font-bold uppercase text-neutral-500">
            Hide and seek (cyan H1–H3 on preview; seed picks the spot)
          </span>
          {H.spots.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1 text-xs">
              <input
                aria-label={`Spot ${i + 1} label`}
                className={`${input} w-36`}
                maxLength={40}
                value={s.label}
                onChange={(e) => setH((h) => (h.spots[i]!.label = e.target.value))}
              />
              <select
                aria-label={`Spot ${i + 1} kind`}
                className={`${input} w-24`}
                value={s.kind}
                onChange={(e) => setH((h) => (h.spots[i]!.kind = e.target.value as HideSpotKind))}
              >
                {HIDE_SPOT_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <PointRow name={`H${i + 1}`} p={s} set={(fn) => setH((h) => fn(h.spots[i]!))} />
            </div>
          ))}
          <label className="flex items-center gap-1 text-xs text-neutral-400">
            Hint after ms
            <input
              type="number"
              className={`${input} w-20`}
              value={H.hintAfterMs}
              onChange={(e) => setH((h) => (h.hintAfterMs = Number(e.target.value)))}
            />
          </label>
          {(
            [
              ["hintLine", "Hint whisper"],
              ["wrongLine", "Wrong-spot whisper"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-neutral-400">
              {l}
              <input
                className={input}
                maxLength={140}
                value={H[k]}
                onChange={(e) => setH((h) => (h[k] = e.target.value))}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Preview overlay markers for the editor scene. */
export function TidyExtrasMarkers({ tidy }: { tidy: TidyOptions }) {
  const P = tidy.possessed;
  const H = tidy.hideSeek;
  const dot =
    "pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed text-[9px] font-bold";
  return (
    <>
      {P &&
        [...P.mainZones.map((z) => ({ z, c: "border-amber-200/50" })), ...P.lampZones.map((z) => ({ z, c: "border-orange-400/60" }))].map(
          ({ z, c }, i) => (
            <div
              key={`z-${i}`}
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${c}`}
              style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.r * 2}%`, aspectRatio: "1" }}
            />
          ),
        )}
      {P?.slots.map((s, i) => (
        <div key={`p-${i}`} className={`${dot} h-7 w-7 border-fuchsia-400 text-fuchsia-200`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          P{i + 1}
        </div>
      ))}
      {P && (
        <>
          <div className={`${dot} h-7 w-7 border-amber-300 text-amber-200`} style={{ left: `${P.mainSwitch.x}%`, top: `${P.mainSwitch.y}%` }}>
            💡
          </div>
          <div className={`${dot} h-7 w-7 border-orange-400 text-orange-200`} style={{ left: `${P.lamp.x}%`, top: `${P.lamp.y}%` }}>
            🪔
          </div>
        </>
      )}
      {H?.spots.map((s, i) => (
        <div key={`h-${i}`} className={`${dot} h-7 w-7 border-cyan-300 text-cyan-200`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          H{i + 1}
        </div>
      ))}
    </>
  );
}
