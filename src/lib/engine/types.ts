export type Metric =
  | "quality"
  | "location"
  | "groupFit"
  | "flexibility"
  | "dataConfidence"
  | "value";

export const ALL_METRICS: Metric[] = [
  "quality",
  "location",
  "groupFit",
  "flexibility",
  "dataConfidence",
  "value",
];

export type MetricStatus = "available" | "partial" | "unavailable";

export interface TripContext {
  destinationLabel: string;
  lat: number | null;
  lng: number | null;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  rooms: number;
  minNightly: number | null;
  maxNightly: number | null;
  radiusKm: number | null;
  currency: string;
}

export interface NormalizedAccommodation {
  id: string;
  bookingUrl: string | null;
  supplierIds: string[];
  supplierLinks: string[];
  supplierCount: number | null;
  name: string | null;
  propertyType: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  guestRating: number | null;
  stars: number | null;
  reviewCount: number | null;
  capacity: number | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
  freeCancellation: boolean | null;
  instantBooking: boolean | null;
  thumbnailUrl: string | null;
  /**
   * Comparable nightly price for the requested trip, only set when the live
   * integration returns real prices on a consistent basis. Never fabricated.
   */
  nightlyPrice: number | null;
  provenance: Record<string, string[]>;
}

export interface MetricValue {
  value: number | null;
  status: MetricStatus;
  confidence: number;
  notes: string[];
}

export type HotelMetrics = Record<Metric, MetricValue>;

export interface MetricAvailability {
  metric: Metric;
  status: MetricStatus;
  coverage: number;
  variation: number;
  reason?: string;
}

export type ExclusionReason =
  | "MISSING_PROPERTY_ID"
  | "INSUFFICIENT_CAPACITY"
  | "UNKNOWN_CAPACITY_FAIL_CLOSED"
  | "INSUFFICIENT_ROOMS"
  | "OUTSIDE_BOUNDARY"
  | "MISSING_REQUIRED_COORDINATES"
  | "OUTSIDE_PRICE_LIMITS";

export interface ExcludedProperty {
  id: string;
  name: string | null;
  reasons: ExclusionReason[];
}

export interface EligibilityResult {
  eligible: NormalizedAccommodation[];
  excluded: ExcludedProperty[];
}

export interface AnswerOption {
  id: string;
  label: string;
  effects: Partial<Record<Metric, number>>;
  flags?: Array<"allow_hidden_gem" | "broaden_diversity" | "lower_certainty">;
}

export interface QuestionCondition {
  requiredMetrics?: Metric[];
  minimumPartySize?: number;
  maximumPartySize?: number;
  previousAnswers?: Record<string, string[]>;
}

export interface PreferenceQuestion {
  id: string;
  text: string;
  type: "single_select" | "multi_select";
  options: AnswerOption[];
  condition?: QuestionCondition;
}

export interface TravelerAnswer {
  questionId: string;
  optionIds: string[];
}

export type PreferencePoints = Partial<Record<Metric, number>>;
export type NormalizedWeights = Partial<Record<Metric, number>>;

export interface SimulationConfig {
  count: number;
  concentration: number;
  seed: string;
  algorithmVersion: string;
}

export interface MetricContribution {
  metric: Metric;
  winnerValue: number;
  opponentValue: number;
  weight: number;
  difference: number;
}

export interface ComparisonExplanation {
  winnerId: string | null;
  mainAdvantages: MetricContribution[];
  opponentAdvantages: MetricContribution[];
  caveats: string[];
}

export interface HotelRankStats {
  hotelId: string;
  deterministicScore: number;
  firstPlaceProbability: number;
  topThreeProbability: number;
  averageRank: number;
  medianRank: number;
  averageUtility: number;
}

export interface RegretResult {
  hotelId: string;
  average: number;
  maximumObserved: number;
  percentile95: number;
}

export interface RankingExplanation {
  leaderId: string;
  mainReasons: MetricContribution[];
  stability: { firstPlaceProbability: number; gap: number };
  safestAlternativeId: string | null;
  caveats: string[];
}

export interface EngineConfig {
  version: string;
  ratingScaleMin: number;
  ratingScaleMax: number;
  qualityShrinkageM: number;
  missingReviewCountPseudo: number;
  defaultRadiusKm: number;
  supplierSaturation: number;
  valueLambda: number;
  valueCoverageThreshold: number;
  metricCoverageThreshold: number;
  metricVariationThreshold: number;
  baselinePoints: number;
  simulationCount: number;
  concentration: number;
  lowConcentration: number;
  failClosedPartySize: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  version: "cic-engine-1.0.0",
  ratingScaleMin: 0,
  ratingScaleMax: 10,
  qualityShrinkageM: 25,
  missingReviewCountPseudo: 10,
  defaultRadiusKm: 10,
  supplierSaturation: 5,
  valueLambda: 0.6,
  valueCoverageThreshold: 0.8,
  metricCoverageThreshold: 0.6,
  metricVariationThreshold: 3,
  baselinePoints: 10,
  simulationCount: 5000,
  concentration: 40,
  lowConcentration: 25,
  failClosedPartySize: 5,
};

export interface EngineInput {
  trip: TripContext;
  hotels: NormalizedAccommodation[];
  answers: TravelerAnswer[];
  fallbackProfile?: string;
  config?: Partial<EngineConfig>;
}

export interface EngineResult {
  version: string;
  seed: string;
  config: SimulationConfig;
  eligibleIds: string[];
  excluded: ExcludedProperty[];
  metricsById: Record<string, HotelMetrics>;
  availability: MetricAvailability[];
  activeMetrics: Metric[];
  weightSource: { kind: "answers"; answered: number } | { kind: "profile"; profile: string };
  points: PreferencePoints;
  weights: NormalizedWeights;
  ranking: HotelRankStats[];
  regret: RegretResult[];
  explanation: RankingExplanation;
  championId: string;
  runnerUpId: string | null;
  championVsRunnerUp: ComparisonExplanation | null;
  championWinProbability: number;
}
