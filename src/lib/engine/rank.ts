import type { MonteCarloResult } from "./simulate";
import type { HotelRankStats, RegretResult } from "./types";

export interface RankingOutput {
  ranking: HotelRankStats[]; // sorted best-first
  regret: RegretResult[];
  stabilityGap: number;
}

/**
 * Full-pool ranking, regret, and stability aggregation (§8–9). Exact ties in
 * a simulation break by stable hotel-index order (reproducible, reported via
 * tie incidence being visible in probabilities).
 */
export function aggregateRanking(
  mc: MonteCarloResult,
  hotelIds: string[],
  deterministicScores: number[],
): RankingOutput {
  const n = hotelIds.length;
  const sims = mc.utilities.length;
  const firstCount = new Array<number>(n).fill(0);
  const top3Count = new Array<number>(n).fill(0);
  const rankSum = new Array<number>(n).fill(0);
  const rankCounts: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const utilitySum = new Array<number>(n).fill(0);
  const regretSum = new Array<number>(n).fill(0);
  const regretMax = new Array<number>(n).fill(0);
  const regretSamples: Float64Array[] = Array.from({ length: n }, () => new Float64Array(sims));

  const order = Array.from({ length: n }, (_, i) => i);
  for (let s = 0; s < sims; s++) {
    const row = mc.utilities[s];
    const sorted = [...order].sort((a, b) => row[b] - row[a] || a - b);
    const best = row[sorted[0]];
    for (let pos = 0; pos < n; pos++) {
      const h = sorted[pos];
      const rank = pos + 1;
      if (rank === 1) firstCount[h]++;
      if (rank <= 3) top3Count[h]++;
      rankSum[h] += rank;
      rankCounts[h][pos]++;
      utilitySum[h] += row[h];
      const regret = best - row[h];
      regretSum[h] += regret;
      if (regret > regretMax[h]) regretMax[h] = regret;
      regretSamples[h][s] = regret;
    }
  }

  const stats: HotelRankStats[] = hotelIds.map((hotelId, h) => ({
    hotelId,
    deterministicScore: deterministicScores[h],
    firstPlaceProbability: firstCount[h] / sims,
    topThreeProbability: top3Count[h] / sims,
    averageRank: rankSum[h] / sims,
    medianRank: medianRankFromCounts(rankCounts[h], sims),
    averageUtility: utilitySum[h] / sims,
  }));

  const regret: RegretResult[] = hotelIds.map((hotelId, h) => {
    const sorted = Float64Array.from(regretSamples[h]).sort();
    return {
      hotelId,
      average: regretSum[h] / sims,
      maximumObserved: regretMax[h],
      percentile95: percentileSorted(sorted, 0.95),
    };
  });

  const ranking = [...stats].sort(
    (a, b) =>
      b.firstPlaceProbability - a.firstPlaceProbability ||
      b.deterministicScore - a.deterministicScore ||
      (a.hotelId < b.hotelId ? -1 : 1),
  );
  const stabilityGap =
    ranking.length > 1
      ? ranking[0].firstPlaceProbability - ranking[1].firstPlaceProbability
      : ranking[0]?.firstPlaceProbability ?? 0;

  return { ranking, regret, stabilityGap };
}

function medianRankFromCounts(counts: number[], sims: number): number {
  const half = sims / 2;
  let cumulative = 0;
  for (let pos = 0; pos < counts.length; pos++) {
    cumulative += counts[pos];
    if (cumulative >= half) return pos + 1;
  }
  return counts.length;
}

function percentileSorted(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
