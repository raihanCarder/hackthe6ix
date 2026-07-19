import { createRng, type Rng } from "@/lib/engine/seed";
import type { NormalizedAccommodation } from "@/lib/engine/types";

/**
 * Hybrid tournament simulation (documentation/ARCHITECTURE.md):
 *
 *   INVARIANT — the engine's #1 recommendation always wins the tournament.
 *
 * Every other fixture is decided by engine utility plus small bounded
 * seeded noise (±MAX_NOISE per side), so drama can only flip near-ties and
 * large quality gaps stay decisive. Card rarity and cosmetics never enter.
 */

const MAX_NOISE = 4;

export type Round = "group" | "quarterfinal" | "semifinal" | "final";

export type MatchEventKind = "goal" | "chance";

export interface MatchHighlight {
  minute: number;
  propertyId: string;
  text: string;
  /**
   * "goal" events sum exactly to the scoreline and drive the live scorebug;
   * "chance" events are flavor drawn from real listing attributes. Optional so
   * brackets persisted before canonical goals still type-check (the broadcast
   * derives goals for those via deriveTimeline).
   */
  kind?: MatchEventKind;
}

export interface MatchResult {
  round: Round;
  group: string | null;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  winnerId: string;
  highlights: MatchHighlight[];
}

export interface GroupTableRow {
  propertyId: string;
  played: number;
  won: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface GroupResult {
  name: string;
  memberIds: string[];
  matches: MatchResult[];
  table: GroupTableRow[];
  advancingIds: [string, string];
}

export interface TournamentBracket {
  groups: GroupResult[];
  knockout: { round: Round; matches: MatchResult[] }[];
  championId: string;
  runnerUpId: string;
}

export interface SimInput {
  groups: string[][];
  championId: string; // engine's #1 — guaranteed winner
  utilityById: Map<string, number>; // engine deterministic scores (0–100)
  hotelsById: Map<string, NormalizedAccommodation>;
  seed: string;
}

export function simulateTournament(input: SimInput): TournamentBracket {
  const rng = createRng(`tournament:${input.seed}`);
  if (!input.groups.some((g) => g.includes(input.championId))) {
    throw new Error("Champion invariant violated: engine #1 is not in the bracket");
  }

  const groups: GroupResult[] = input.groups.map((memberIds, i) =>
    playGroup(String.fromCharCode(65 + i), memberIds, input, rng),
  );

  // Knockout pairings: A1–B2, B1–A2, C1–D2, D1–C2 (scaled down for smaller fields).
  let contenders: string[] = [];
  for (let i = 0; i < groups.length; i += 2) {
    const g1 = groups[i];
    const g2 = groups[i + 1];
    if (g2) {
      contenders.push(g1.advancingIds[0], g2.advancingIds[1], g2.advancingIds[0], g1.advancingIds[1]);
    } else {
      contenders.push(g1.advancingIds[0], g1.advancingIds[1]);
    }
  }

  const knockout: TournamentBracket["knockout"] = [];
  const roundName = (size: number): Round =>
    size === 8 ? "quarterfinal" : size === 4 ? "semifinal" : "final";

  while (contenders.length > 1) {
    const round = roundName(contenders.length);
    const matches: MatchResult[] = [];
    const winners: string[] = [];
    for (let i = 0; i < contenders.length; i += 2) {
      const match = playMatch(round, null, contenders[i], contenders[i + 1], input, rng);
      matches.push(match);
      winners.push(match.winnerId);
    }
    knockout.push({ round, matches });
    contenders = winners;
  }

  const final = knockout[knockout.length - 1].matches[0];
  return {
    groups,
    knockout,
    championId: final.winnerId,
    runnerUpId: final.winnerId === final.homeId ? final.awayId : final.homeId,
  };
}

function playGroup(name: string, memberIds: string[], input: SimInput, rng: Rng): GroupResult {
  const matches: MatchResult[] = [];
  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      matches.push(playMatch("group", name, memberIds[i], memberIds[j], input, rng));
    }
  }

  const rows = new Map<string, GroupTableRow>(
    memberIds.map((id) => [
      id,
      { propertyId: id, played: 0, won: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
    ]),
  );
  for (const match of matches) {
    const home = rows.get(match.homeId)!;
    const away = rows.get(match.awayId)!;
    home.played++;
    away.played++;
    home.goalsFor += match.homeGoals;
    home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals;
    away.goalsAgainst += match.homeGoals;
    const winner = rows.get(match.winnerId)!;
    const loser = match.winnerId === match.homeId ? away : home;
    winner.won++;
    winner.points += 3;
    loser.lost++;
  }

  const table = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      (input.utilityById.get(b.propertyId) ?? 0) - (input.utilityById.get(a.propertyId) ?? 0) ||
      (a.propertyId < b.propertyId ? -1 : 1),
  );

  return {
    name,
    memberIds,
    matches,
    table,
    advancingIds: [table[0].propertyId, table[1].propertyId],
  };
}

function playMatch(
  round: Round,
  group: string | null,
  homeId: string,
  awayId: string,
  input: SimInput,
  rng: Rng,
): MatchResult {
  const uHome = input.utilityById.get(homeId) ?? 0;
  const uAway = input.utilityById.get(awayId) ?? 0;

  let winnerId: string;
  if (homeId === input.championId) {
    winnerId = homeId;
    rng(); // keep the stream aligned regardless of champion participation
    rng();
  } else if (awayId === input.championId) {
    winnerId = awayId;
    rng();
    rng();
  } else {
    const noisyHome = uHome + (rng() * 2 - 1) * MAX_NOISE;
    const noisyAway = uAway + (rng() * 2 - 1) * MAX_NOISE;
    winnerId =
      noisyHome > noisyAway || (noisyHome === noisyAway && homeId < awayId) ? homeId : awayId;
  }

  const gap = Math.abs(uHome - uAway);
  const winnerGoals = 1 + Math.floor(rng() * 2) + (gap > 12 ? 1 : 0);
  const loserGoals = Math.max(0, Math.min(winnerGoals - 1, Math.floor(rng() * winnerGoals)));
  const homeGoals = winnerId === homeId ? winnerGoals : loserGoals;
  const awayGoals = winnerId === awayId ? winnerGoals : loserGoals;

  return {
    round,
    group,
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    winnerId,
    highlights: buildTimeline(homeId, awayId, winnerId, homeGoals, awayGoals, input, rng),
  };
}

/**
 * The match timeline: canonical goal events (exactly homeGoals + awayGoals,
 * one per goal) merged with flavor "chance" moments drawn only from real
 * listing attributes (documentation/ideas/IDEA.md). Goal events let the live
 * scorebug climb to the exact final score; chances fill the ticker between them.
 */
function buildTimeline(
  homeId: string,
  awayId: string,
  winnerId: string,
  homeGoals: number,
  awayGoals: number,
  input: SimInput,
  rng: Rng,
): MatchHighlight[] {
  const usedMinutes = new Set<number>();
  // Distinct minute in 1–89 (90 is reserved for full time).
  const nextMinute = (): number => {
    let minute = 1 + Math.floor(rng() * 89);
    let guard = 0;
    while (usedMinutes.has(minute) && guard++ < 200) minute = 1 + Math.floor(rng() * 89);
    usedMinutes.add(minute);
    return minute;
  };

  const events: MatchHighlight[] = [];

  // Goals — canonical, one event per goal, summing to the scoreline.
  for (const [id, goals] of [
    [homeId, homeGoals],
    [awayId, awayGoals],
  ] as const) {
    const name = input.hotelsById.get(id)?.name ?? "The property";
    for (let g = 0; g < goals; g++) {
      events.push({ minute: nextMinute(), propertyId: id, kind: "goal", text: goalText(name, rng) });
    }
  }

  // Chances — flavor from real attributes, never affect the score.
  const candidates: Array<{ propertyId: string; text: string }> = [];
  for (const id of [homeId, awayId]) {
    const hotel = input.hotelsById.get(id);
    if (!hotel) continue;
    const name = hotel.name ?? "The property";
    if (hotel.freeCancellation) {
      candidates.push({ propertyId: id, text: `${name}'s Free Cancellation Shield blocks a dangerous commitment.` });
    }
    const suppliers = hotel.supplierCount ?? hotel.supplierIds.length;
    if (suppliers >= 3) {
      candidates.push({ propertyId: id, text: `${suppliers} supplier offers open the Transfer Window for ${name} — +FLEX surge.` });
    }
    if (hotel.instantBooking) {
      candidates.push({ propertyId: id, text: `Instant Book! ${name} threatens with a First-Touch move.` });
    }
    if ((hotel.reviewCount ?? 0) > 500) {
      candidates.push({ propertyId: id, text: `${hotel.reviewCount} reviews power a veteran LEGACY attack from ${name}.` });
    }
    if ((hotel.guestRating ?? 0) >= 9) {
      candidates.push({ propertyId: id, text: `A ${hotel.guestRating}-rated VIBE run — ${name} has the crowd on its feet.` });
    }
    if (hotel.nightlyPrice !== null) {
      candidates.push({ propertyId: id, text: `${name} starts a counterattack on VALUE at $${hotel.nightlyPrice}/night.` });
    }
    if ((hotel.capacity ?? 0) >= 6) {
      candidates.push({ propertyId: id, text: `Sleeps ${hotel.capacity} — ${name} brings serious SQUAD depth off the bench.` });
    }
  }

  const chanceCount = Math.min(candidates.length, 4 + Math.floor(rng() * 3));
  const pool = [...candidates];
  for (let i = 0; i < chanceCount && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [candidate] = pool.splice(idx, 1);
    events.push({ minute: nextMinute(), kind: "chance", ...candidate });
  }

  events.sort((a, b) => a.minute - b.minute);

  const winner = input.hotelsById.get(winnerId);
  events.push({
    minute: 90,
    propertyId: winnerId,
    kind: "chance",
    text:
      homeGoals === awayGoals
        ? `Full time! ${winner?.name ?? "The winner"} edges it on the day.`
        : `Full time! ${winner?.name ?? "The winner"} takes the tie.`,
  });
  return events;
}

const GOAL_PHRASES = [
  "buries it in the top corner!",
  "finishes clinically!",
  "slots it home!",
  "heads it in off the post!",
  "curls one in from range!",
  "taps in at the far post!",
];

function goalText(name: string, rng: Rng): string {
  return `GOAL! ${name} ${GOAL_PHRASES[Math.floor(rng() * GOAL_PHRASES.length)]}`;
}
