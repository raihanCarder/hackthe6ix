import type { PairwiseProbabilities } from "./simulate";
import type {
  ComparisonExplanation,
  HotelMetrics,
  HotelRankStats,
  Metric,
  MetricContribution,
  NormalizedWeights,
  RankingExplanation,
  RegretResult,
} from "./types";

/** Contribution deltas at base weights (§10). Auditable, no invented facts. */
export function contributionDeltas(
  winner: HotelMetrics,
  opponent: HotelMetrics,
  weights: NormalizedWeights,
): MetricContribution[] {
  const deltas: MetricContribution[] = [];
  for (const [metric, weight] of Object.entries(weights) as Array<[Metric, number]>) {
    const a = winner[metric]?.value;
    const b = opponent[metric]?.value;
    if (a === null || a === undefined || b === null || b === undefined) continue;
    deltas.push({
      metric,
      winnerValue: a,
      opponentValue: b,
      weight,
      difference: weight * a - weight * b,
    });
  }
  return deltas.sort((x, y) => Math.abs(y.difference) - Math.abs(x.difference));
}

export function metricCaveats(ids: string[], metricsById: Record<string, HotelMetrics>): string[] {
  const caveats: string[] = [];
  for (const id of ids) {
    const metrics = metricsById[id];
    if (!metrics) continue;
    for (const [metric, value] of Object.entries(metrics)) {
      if (value.status === "partial" || value.status === "unavailable") {
        for (const note of value.notes) {
          const line = `${metric}: ${note}`;
          if (!caveats.includes(line)) caveats.push(line);
        }
      }
    }
  }
  return caveats.slice(0, 6);
}

export function buildComparisonExplanation(
  winnerId: string,
  opponentId: string,
  pairwise: PairwiseProbabilities,
  metricsById: Record<string, HotelMetrics>,
  weights: NormalizedWeights,
): ComparisonExplanation {
  const deltas = contributionDeltas(metricsById[winnerId], metricsById[opponentId], weights);
  return {
    winnerId,
    mainAdvantages: deltas.filter((d) => d.difference > 0).slice(0, 3),
    opponentAdvantages: deltas.filter((d) => d.difference < 0).slice(0, 3),
    caveats: metricCaveats([winnerId, opponentId], metricsById),
  };
}

/**
 * Ranking explanation (§10): why the leader leads, its stability, and the
 * safest low-regret alternative among competitive candidates.
 */
export function buildRankingExplanation(
  ranking: HotelRankStats[],
  regret: RegretResult[],
  metricsById: Record<string, HotelMetrics>,
  weights: NormalizedWeights,
  stabilityGap: number,
): RankingExplanation {
  const leader = ranking[0];
  const runnerUp = ranking[1] ?? null;

  const mainReasons = runnerUp
    ? contributionDeltas(metricsById[leader.hotelId], metricsById[runnerUp.hotelId], weights)
        .filter((d) => d.difference > 0)
        .slice(0, 3)
    : [];

  // Safest alternative: lowest p95 regret among competitive non-leaders
  // (within 10 deterministic points of the leader or top five by rank).
  const competitive = ranking
    .slice(1)
    .filter(
      (h, idx) => idx < 4 || leader.deterministicScore - h.deterministicScore <= 10,
    )
    .map((h) => ({
      stats: h,
      regret: regret.find((r) => r.hotelId === h.hotelId),
    }))
    .filter((x): x is { stats: HotelRankStats; regret: RegretResult } => Boolean(x.regret))
    .sort((a, b) => a.regret.percentile95 - b.regret.percentile95 || a.regret.average - b.regret.average);

  return {
    leaderId: leader.hotelId,
    mainReasons,
    stability: { firstPlaceProbability: leader.firstPlaceProbability, gap: stabilityGap },
    safestAlternativeId: competitive[0]?.stats.hotelId ?? null,
    caveats: metricCaveats(
      [leader.hotelId, runnerUp?.hotelId].filter((x): x is string => Boolean(x)),
      metricsById,
    ),
  };
}
