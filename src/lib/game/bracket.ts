import { createRng } from "@/lib/engine/seed";
import type { HotelRankStats, NormalizedAccommodation } from "@/lib/engine/types";

/**
 * 16-team contender selection and group seeding (GAMEPLAY_PACK_IDEAS.md).
 * The engine's #1 recommendation is always force-included, the user's pack
 * cards enter as "your squad", and remaining slots are stratified-sampled
 * across price and rating bands so opponents feel varied while staying
 * tied to the same live search.
 */

export interface BracketPlan {
  contenderIds: string[];
  groups: string[][]; // group letters A.. in order, 4 ids each, seeded snake-style
}

export function buildBracketContenders(args: {
  eligible: NormalizedAccommodation[];
  ranking: HotelRankStats[];
  userPropertyIds: string[];
  seed: string;
}): BracketPlan {
  const { eligible, ranking, userPropertyIds, seed } = args;
  const rng = createRng(`bracket:${seed}`);
  const scoreById = new Map(ranking.map((r) => [r.hotelId, r.deterministicScore]));
  const eligibleIds = new Set(eligible.map((h) => h.id));

  const targetSize = eligible.length >= 16 ? 16 : eligible.length >= 8 ? 8 : 4;
  const picked: string[] = [];
  const pickedSet = new Set<string>();
  const add = (id: string) => {
    if (!pickedSet.has(id) && eligibleIds.has(id) && picked.length < targetSize) {
      picked.push(id);
      pickedSet.add(id);
    }
  };

  // 1. The engine champion is always in the tournament.
  if (ranking.length > 0) add(ranking[0].hotelId);
  // 2. The user's pack cards.
  for (const id of userPropertyIds) add(id);
  // 3. Stratified fill: price tercile × rating tercile strata, round-robin.
  const remaining = eligible.filter((h) => !pickedSet.has(h.id));
  const strata = stratify(remaining, rng);
  let safety = 1000;
  while (picked.length < targetSize && safety-- > 0) {
    let addedAny = false;
    for (const stratum of strata) {
      if (picked.length >= targetSize) break;
      const next = stratum.shift();
      if (next) {
        add(next.id);
        addedAny = true;
      }
    }
    if (!addedAny) break;
  }

  // Seed by engine deterministic score, snake-distribute into groups of 4.
  const seeded = [...picked].sort(
    (a, b) => (scoreById.get(b) ?? 0) - (scoreById.get(a) ?? 0) || (a < b ? -1 : 1),
  );
  const groupCount = seeded.length / 4;
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  seeded.forEach((id, index) => {
    const row = Math.floor(index / groupCount);
    const col = index % groupCount;
    const g = row % 2 === 0 ? col : groupCount - 1 - col;
    groups[g].push(id);
  });

  return { contenderIds: seeded, groups };
}

function stratify(
  pool: NormalizedAccommodation[],
  rng: () => number,
): NormalizedAccommodation[][] {
  if (pool.length === 0) return [];
  const prices = pool.map((h) => h.nightlyPrice ?? Number.NaN).filter(Number.isFinite);
  const ratings = pool.map((h) => h.guestRating ?? Number.NaN).filter(Number.isFinite);
  const priceCuts = terciles(prices);
  const ratingCuts = terciles(ratings);

  const buckets = new Map<string, NormalizedAccommodation[]>();
  for (const hotel of pool) {
    const p = band(hotel.nightlyPrice, priceCuts);
    const r = band(hotel.guestRating, ratingCuts);
    const key = `${p}:${r}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(hotel);
    buckets.set(key, bucket);
  }
  const strata = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, hotels]) => shuffle(hotels, rng));
  return shuffle(strata, rng);
}

function terciles(values: number[]): [number, number] | null {
  if (values.length < 3) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return [sorted[Math.floor(sorted.length / 3)], sorted[Math.floor((2 * sorted.length) / 3)]];
}

function band(value: number | null, cuts: [number, number] | null): string {
  if (value === null || cuts === null) return "u";
  return value <= cuts[0] ? "lo" : value <= cuts[1] ? "mid" : "hi";
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
