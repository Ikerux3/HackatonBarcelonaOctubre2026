import type { AssetId } from "./levels/assets";
import type { MomRoomOptions } from "./levels/types";
import { DEFAULT_NAME } from "./playerName";

/**
 * Minigame 04 "El cuarto de mamá" (Drive D39 → D42/D45, approved by Iker on 10 oct).
 * The code is deterministic: the vanity card orders the clue objects (photo → little box
 * → clock) and the dark shows the mark on each one (flower, moon, eye). No randomness,
 * no contradictory clues; a wrong code costs nothing. The AI never touches these rules.
 */

/** The drawer's code: the mark of each clue object, in the card's order. */
export function momCode(m: Pick<MomRoomOptions, "marks" | "order">): AssetId[] {
  return m.order.map((id) => m.marks[id]!);
}

export type PanelResult = "ok" | "wrong" | "open";

/**
 * One tap on the drawer panel. A wrong code clears the panel — no scare, no Cordura,
 * nothing else is lost (D39: "error simple permite repetir sin pérdida").
 */
export function pressPanel(
  input: AssetId[],
  symbol: AssetId,
  code: AssetId[],
): { input: AssetId[]; result: PanelResult } {
  const next = [...input, symbol];
  if (next.length < code.length) return { input: next, result: "ok" };
  return next.every((s, i) => s === code[i])
    ? { input: [], result: "open" }
    : { input: [], result: "wrong" };
}

/**
 * Puts the player's locally validated name into a line (`{name}`). D45: The Guest says it
 * for the FIRST time in this minigame, with mom's borrowed voice — never before.
 */
export function withName(line: string, name: string | undefined): string {
  const text = line.replaceAll("{name}", name?.trim() || DEFAULT_NAME);
  // "sweetie, come here…" still starts a sentence
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
