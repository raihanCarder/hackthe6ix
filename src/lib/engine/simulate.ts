import { createRng, sampleDirichlet } from "./seed";
import type {
  HotelMetrics,
  Metric,
  NormalizedWeights,
  SimulationConfig,
} from "./types";

/**
 * Per-hotel metric vectors over the active metrics, null where a hotel is
 * missing an otherwise-active metric. Utilities renormalize over known
 * metrics rather than silently imputing 50 (documentation/ideas/ALGORITHM_DESIGN.md §5).
 */
export interface MetricMatrix {
  hotelIds: string[];
  metrics: Metric[];
  values: Array<Array<number | null>>; // hotels × metrics
}

export function buildMetricMatrix(
  hotelIds: string[],
  metricsById: Record<string, HotelMetrics>,
  activeMetrics: Metric[],
): MetricMatrix {
  return {
    hotelIds,
    metrics: activeMetrics,
    values: hotelIds.map((id) => activeMetrics.map((m) => metricsById[id][m].value)),
  };
}

export function weightVector(weights: NormalizedWeights, metrics: Metric[]): number[] {
  return metrics.map((m) => weights[m] ?? 0);
}

/** Weighted score for one hotel row, renormalizing over non-null metrics. */
export function scoreRow(row: Array<number | null>, w: number[]): number {
  let sum = 0;
  let weightSum = 0;
  for (let j = 0; j < row.length; j++) {
    const v = row[j];
    if (v === null || w[j] <= 0) continue;
    sum += w[j] * v;
    weightSum += w[j];
  }
  return weightSum > 0 ? sum / weightSum : 0;
}

export function calculateBaseScores(matrix: MetricMatrix, weights: NormalizedWeights): number[] {
  const w = weightVector(weights, matrix.metrics);
  return matrix.values.map((row) => scoreRow(row, w));
}

export interface MonteCarloResult {
  /** utilities[s][h] — simulations × hotels */
  utilities: Float64Array[];
  config: SimulationConfig;
}

/**
 * Seeded Dirichlet Monte Carlo over traveler weights (§6). Hotel facts are
 * never perturbed; only preference weights vary.
 */
export function runMonteCarlo(
  matrix: MetricMatrix,
  weights: NormalizedWeights,
  config: SimulationConfig,
): MonteCarloResult {
  const base = weightVector(weights, matrix.metrics);
  const activeIdx = base.map((w, i) => ({ w, i })).filter((x) => x.w > 0);
  const alphas = activeIdx.map((x) => Math.max(x.w * config.concentration, 1e-9));
  const rng = createRng(config.seed);
  const hotelCount = matrix.hotelIds.length;

  const utilities: Float64Array[] = [];
  for (let s = 0; s < config.count; s++) {
    const sampled = sampleDirichlet(rng, alphas);
    const w = new Array<number>(matrix.metrics.length).fill(0);
    for (let k = 0; k < activeIdx.length; k++) w[activeIdx[k].i] = sampled[k];
    const row = new Float64Array(hotelCount);
    for (let h = 0; h < hotelCount; h++) {
      row[h] = scoreRow(matrix.values[h], w);
    }
    utilities.push(row);
  }
  return { utilities, config };
}

export interface PairwiseProbabilities {
  probabilityA: number;
  probabilityB: number;
  tieProbability: number;
  meanUtilityA: number;
  meanUtilityB: number;
}

const EPSILON = 1e-9;

/** Pairwise win/tie frequencies reusing the same simulation draws (§7). */
export function pairwiseFromUtilities(
  mc: MonteCarloResult,
  indexA: number,
  indexB: number,
): PairwiseProbabilities {
  let winsA = 0;
  let winsB = 0;
  let sumA = 0;
  let sumB = 0;
  for (const row of mc.utilities) {
    const a = row[indexA];
    const b = row[indexB];
    sumA += a;
    sumB += b;
    if (a > b + EPSILON) winsA++;
    else if (b > a + EPSILON) winsB++;
  }
  const n = mc.utilities.length;
  return {
    probabilityA: winsA / n,
    probabilityB: winsB / n,
    tieProbability: 1 - winsA / n - winsB / n,
    meanUtilityA: sumA / n,
    meanUtilityB: sumB / n,
  };
}
