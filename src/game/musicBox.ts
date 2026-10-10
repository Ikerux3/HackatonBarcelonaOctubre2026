/**
 * Minigame 03 "La caja de música" (Drive D38 → D41, approved by Iker on 10 oct): a Simon
 * whose song can only be SEEN with the light off and only TYPED with the light on.
 * Four rounds of 3, 4, 5 and 7 symbols; each round's song starts with the previous one.
 * The rules live here, pure, so they're tested without the UI. The AI never touches them.
 */

export interface MusicBoxProgress {
  /** rounds already done — a checkpoint each: nothing ever takes them away */
  round: number;
  /** symbols typed so far in the current round */
  input: string[];
}

export const initialMusicBox: MusicBoxProgress = { round: 0, input: [] };

/** The run's song: random symbols (never three alike in a row) unless the level fixes one. */
export function musicSequence(
  symbols: string[],
  length: number,
  fixed: string[] | null,
  rand: () => number = Math.random,
): string[] {
  if (fixed) return fixed.slice(0, length);
  const song: string[] = [];
  while (song.length < length && symbols.length > 0) {
    const pick = symbols[Math.floor(rand() * symbols.length)]!;
    const n = song.length;
    if (symbols.length > 1 && n >= 2 && song[n - 1] === pick && song[n - 2] === pick) continue;
    song.push(pick);
  }
  return song;
}

/** What the dark shows in this round: the first `rounds[round]` symbols of the song. */
export function roundSong(song: string[], rounds: number[], round: number): string[] {
  const len = rounds[Math.min(round, rounds.length - 1)] ?? 0;
  return song.slice(0, len);
}

export type NoteResult = "ok" | "wrong" | "round" | "song" | "ignored";

/**
 * One tap on a symbol with the light on. A wrong symbol is a mild error (D38): only what
 * was typed in this round is cleared — no scare, no Cordura, earlier rounds stay done.
 */
export function pressNote(
  p: MusicBoxProgress,
  id: string,
  song: string[],
  rounds: number[],
): { progress: MusicBoxProgress; result: NoteResult } {
  if (p.round >= rounds.length) return { progress: p, result: "ignored" };
  if (song[p.input.length] !== id) return { progress: { ...p, input: [] }, result: "wrong" };
  const input = [...p.input, id];
  if (input.length < rounds[p.round]!) return { progress: { ...p, input }, result: "ok" };
  const round = p.round + 1;
  return { progress: { round, input: [] }, result: round >= rounds.length ? "song" : "round" };
}

/** Turning the light off to see the song again, or the Cordura 100 event: retype this round. */
export function clearInput(p: MusicBoxProgress): MusicBoxProgress {
  return p.input.length ? { ...p, input: [] } : p;
}

/**
 * Which symbol glows `elapsedMs` after the light went off (null = none). The song starts
 * after `leadMs`, each symbol glows `showMs` then waits `gapMs`, and the whole song loops
 * after `loopPauseMs` — as many times as the player wants to watch it.
 */
export function glowAt(
  elapsedMs: number,
  song: string[],
  t: { showMs: number; gapMs: number; loopPauseMs: number; leadMs: number },
): { id: string | null; step: string | null; loops: number } {
  const since = elapsedMs - t.leadMs;
  if (since < 0 || song.length === 0) return { id: null, step: null, loops: 0 };
  const slotMs = t.showMs + t.gapMs;
  const loopMs = song.length * slotMs + t.loopPauseMs;
  const loops = Math.floor(since / loopMs);
  const inLoop = since - loops * loopMs;
  const slot = Math.floor(inLoop / slotMs);
  const lit = slot < song.length && inLoop - slot * slotMs < t.showMs;
  return lit
    ? { id: song[slot]!, step: `${loops}:${slot}`, loops }
    : { id: null, step: null, loops };
}
