import { applyHardConstraints } from "./constraints";
import { calculatePoolMetrics } from "./metrics";
import {
  applyAnswerEffects,
  profileWeights,
  QUESTION_BANK_VERSION,
} from "./questionnaire";
import { aggregateRanking } from "./rank";
import { hashString, stableStringify } from "./seed";
import {
  buildMetricMatrix,
  calculateBaseScores,
  pairwiseFromUtilities,
  runMonteCarlo,
} from "./simulate";
import { buildComparisonExplanation, buildRankingExplanation } from "./explain";
import type { EngineInput, EngineResult, NormalizedWeights, PreferencePoints } from "./types";
import { DEFAULT_ENGINE_CONFIG } from "./types";

export * from "./types";
export { selectAdaptiveQuestions, QUESTION_BANK, FALLBACK_PROFILES } from "./questionnaire";
export { applyHardConstraints } from "./constraints";
export { calculatePoolMetrics, haversineKm } from "./metrics";
export { hashString, stableStringify, createRng } from "./seed";

/**
 * The complete game-mode-independent recommendation run
 * (ALGORITHM_DESIGN.md §16). Deterministic for identical live facts,
 * answers, and configuration. Nothing downstream may alter its outputs.
 */
export function runEngine(input: EngineInput): EngineResult {
  const config = { ...DEFAULT_ENGINE_CONFIG, ...input.config };
  const { eligible, excluded } = applyHardConstraints(input.hotels, input.trip, config);
  if (eligible.length < 2) {
    throw new EngineError(
      `Only ${eligible.length} eligible properties after hard filters — not enough to compare.`,
    );
  }

  const { metricsById, availability, activeMetrics } = calculatePoolMetrics(
    eligible,
    input.trip,
    config,
  );

  let points: PreferencePoints;
  let weights: NormalizedWeights;
  let weightSource: EngineResult["weightSource"];
  let concentration = config.concentration;

  const computed = applyAnswerEffects(input.answers, activeMetrics, config);
  if (computed.answeredCount > 0) {
    points = computed.points;
    weights = computed.weights;
    weightSource = { kind: "answers", answered: computed.answeredCount };
    if (computed.flags.has("lower_certainty")) concentration = config.lowConcentration;
  } else {
    const profile = input.fallbackProfile ?? "best_overall";
    weights = profileWeights(profile, activeMetrics);
    points = weights as PreferencePoints;
    weightSource = { kind: "profile", profile };
  }

  const hotelIds = [...eligible.map((h) => h.id)].sort();
  const matrix = buildMetricMatrix(hotelIds, metricsById, activeMetrics);
  const deterministicScores = calculateBaseScores(matrix, weights);

  const seed = hashString(
    stableStringify({
      trip: input.trip,
      hotelIds,
      factsHash: hashString(stableStringify(eligible.map((h) => ({ ...h, provenance: undefined })))),
      answers: input.answers,
      activeMetrics,
      weights,
      questionBank: QUESTION_BANK_VERSION,
      engine: config.version,
      count: config.simulationCount,
      concentration,
    }),
  );

  const simConfig = {
    count: config.simulationCount,
    concentration,
    seed,
    algorithmVersion: config.version,
  };
  const mc = runMonteCarlo(matrix, weights, simConfig);
  const { ranking, regret, stabilityGap } = aggregateRanking(mc, hotelIds, deterministicScores);
  const explanation = buildRankingExplanation(ranking, regret, metricsById, weights, stabilityGap);

  const championId = ranking[0].hotelId;
  const runnerUpId = ranking[1]?.hotelId ?? null;
  let championVsRunnerUp = null;
  if (runnerUpId) {
    const pairwise = pairwiseFromUtilities(
      mc,
      hotelIds.indexOf(championId),
      hotelIds.indexOf(runnerUpId),
    );
    championVsRunnerUp = buildComparisonExplanation(
      championId,
      runnerUpId,
      pairwise,
      metricsById,
      weights,
    );
  }

  return {
    version: config.version,
    seed,
    config: simConfig,
    eligibleIds: hotelIds,
    excluded,
    metricsById,
    availability,
    activeMetrics,
    weightSource,
    points,
    weights,
    ranking,
    regret,
    explanation,
    championId,
    runnerUpId,
    championVsRunnerUp,
    championWinProbability: ranking[0].firstPlaceProbability,
  };
}

export class EngineError extends Error {}
