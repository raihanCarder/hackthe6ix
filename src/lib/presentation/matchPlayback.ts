/**
 * Match playback — turns a simulated MatchResult into a time-based programme the
 * broadcast can animate: goal events climb a live scorebug to the exact final
 * score, "chance" events fill the ticker, and momentum swings between the two
 * sides. Pure and client-safe (no server-only imports), so it is unit-testable
 * and runs in the browser.
 *
 * Convention: momentum is in [-1, 1]. Negative leans HOME (left), positive leans
 * AWAY (right), 0 is even.
 */
import { createRng } from "@/lib/engine/seed";
import type { MatchHighlight, MatchResult } from "@/lib/game/matchSim";

export type Side = "home" | "away";

export interface PlaybackEvent {
  /** When this event fires within the compressed playback. */
  atMs: number;
  /** Match minute, 1–90. */
  minute: number;
  kind: "goal" | "chance";
  side: Side;
  propertyId: string;
  text: string;
  /** Running score AFTER this event. */
  homeScore: number;
  awayScore: number;
}

export interface PlaybackTimeline {
  durationMs: number;
  events: PlaybackEvent[];
  finalHome: number;
  finalAway: number;
  /** Momentum in [-1, 1] at a given elapsed time (see file header for sign). */
  momentumAt: (tMs: number) => number;
}

export interface PlaybackOptions {
  /** Total wall-clock length of the match playback. */
  durationMs?: number;
  /** Extra entropy so legacy goal-minute derivation is stable across replays. */
  seed?: string;
}

const DEFAULT_DURATION_MS = 9000;
const GOAL_IMPULSE = 0.62;
const CHANCE_IMPULSE = 0.3;
const WINNER_LEAN = 0.1;
/** Smallest gap between consecutive event timestamps so playback never stacks. */
const MIN_GAP_MS = 140;

/**
 * Normalize a match's highlights so every event carries a `kind`, with goal
 * events summing exactly to the scoreline. New brackets already store canonical
 * goals; brackets persisted before that get goals synthesized deterministically
 * here, and their untyped highlights are tagged as chances.
 */
export function deriveTimeline(match: MatchResult, seed = ""): MatchHighlight[] {
  const isCanonical = match.highlights.some((h) => h.kind !== undefined);
  if (isCanonical) {
    return match.highlights.map((h) => ({ ...h, kind: h.kind ?? "chance" }));
  }

  // Legacy bracket: no typed goals. Rebuild a timeline from the scoreline.
  const rng = createRng(`playback:${seed}:${match.homeId}:${match.awayId}`);
  const used = new Set<number>();
  const nextMinute = (): number => {
    let minute = 1 + Math.floor(rng() * 89);
    let guard = 0;
    while (used.has(minute) && guard++ < 200) minute = 1 + Math.floor(rng() * 89);
    used.add(minute);
    return minute;
  };

  const events: MatchHighlight[] = [];
  for (const [id, goals] of [
    [match.homeId, match.homeGoals],
    [match.awayId, match.awayGoals],
  ] as const) {
    for (let g = 0; g < goals; g++) {
      events.push({ minute: nextMinute(), propertyId: id, kind: "goal", text: "GOAL!" });
    }
  }
  for (const h of match.highlights) {
    // Preserve stored flavor text; keep its minute unless it collides with a goal.
    const minute = used.has(h.minute) && h.minute !== 90 ? nextMinute() : h.minute;
    used.add(minute);
    events.push({ ...h, minute, kind: "chance" });
  }
  events.sort((a, b) => a.minute - b.minute);
  return events;
}

/** Build the animatable programme for a single match. */
export function buildPlaybackTimeline(
  match: MatchResult,
  options: PlaybackOptions = {},
): PlaybackTimeline {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const normalized = [...deriveTimeline(match, options.seed)].sort((a, b) => a.minute - b.minute);

  const events: PlaybackEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;
  let prevAt = -Infinity;
  for (const h of normalized) {
    const side: Side = h.propertyId === match.homeId ? "home" : "away";
    if (h.kind === "goal") {
      if (side === "home") homeScore++;
      else awayScore++;
    }
    // Map match minute onto the compressed clock, then force a strictly
    // increasing timestamp so no two beats land on the same frame.
    let atMs = Math.min(durationMs, (h.minute / 90) * durationMs);
    if (atMs <= prevAt + MIN_GAP_MS) atMs = prevAt + MIN_GAP_MS;
    atMs = Math.min(atMs, durationMs);
    prevAt = atMs;
    events.push({
      atMs,
      minute: h.minute,
      kind: h.kind ?? "chance",
      side,
      propertyId: h.propertyId,
      text: h.text,
      homeScore,
      awayScore,
    });
  }

  const winnerLean =
    match.winnerId === match.homeId ? -WINNER_LEAN : match.winnerId === match.awayId ? WINNER_LEAN : 0;
  const tau = durationMs / 5;

  const momentumAt = (tMs: number): number => {
    let value = winnerLean;
    for (const e of events) {
      if (e.atMs > tMs) break;
      const impulse = e.kind === "goal" ? GOAL_IMPULSE : CHANCE_IMPULSE;
      const sign = e.side === "home" ? -1 : 1;
      value += sign * impulse * Math.exp(-(tMs - e.atMs) / tau);
    }
    return clamp(value, -1, 1);
  };

  return {
    durationMs,
    events,
    finalHome: match.homeGoals,
    finalAway: match.awayGoals,
    momentumAt,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Short broadcast-style abbreviation for a club name (e.g. "The Grand Plaza" → "GRA"). */
export function clubAbbrev(name: string | null | undefined): string {
  if (!name) return "———";
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "———";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0] + (words[2]?.[0] ?? words[1][1] ?? "")).toUpperCase();
}
