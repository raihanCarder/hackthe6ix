import type {
  EngineConfig,
  HotelMetrics,
  Metric,
  MetricAvailability,
  MetricValue,
  NormalizedAccommodation,
  TripContext,
} from "./types";
import { ALL_METRICS } from "./types";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const clamp100 = (x: number) => Math.min(100, Math.max(0, x));

const unavailable = (note: string): MetricValue => ({
  value: null,
  status: "unavailable",
  confidence: 0,
  notes: [note],
});

const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Bayesian-shrunk quality score (ALGORITHM_DESIGN.md §2.1). */
export function calculateQualityScore(
  hotel: NormalizedAccommodation,
  poolMeanRating: number | null,
  config: EngineConfig,
): MetricValue {
  if (hotel.guestRating === null) {
    return unavailable("Guest rating unavailable; not inferred from stars.");
  }
  const notes: string[] = [];
  let status: MetricValue["status"] = "available";
  let confidence = 1;

  let n = hotel.reviewCount;
  if (n === null) {
    n = config.missingReviewCountPseudo;
    status = "partial";
    confidence = 0.6;
    notes.push(`Review count unknown; conservative pseudo-count ${n} applied.`);
  }

  const c = poolMeanRating ?? (config.ratingScaleMin + config.ratingScaleMax) / 2;
  if (poolMeanRating === null) {
    notes.push("Too few rated candidates for a pool mean; midpoint prior used.");
    confidence = Math.min(confidence, 0.5);
    status = "partial";
  }

  const m = config.qualityShrinkageM;
  const adjusted = (n / (n + m)) * hotel.guestRating + (m / (n + m)) * c;
  const span = config.ratingScaleMax - config.ratingScaleMin;
  const value = 100 * clamp01((adjusted - config.ratingScaleMin) / span);
  return { value: clamp100(value), status, confidence, notes };
}

/** Linear-decay location fit within an effective radius (§2.2). */
export function calculateLocationScore(
  hotel: NormalizedAccommodation,
  trip: TripContext,
  config: EngineConfig,
): MetricValue {
  if (trip.lat === null || trip.lng === null) {
    return unavailable("No destination coordinates for this search.");
  }
  if (hotel.latitude === null || hotel.longitude === null) {
    return unavailable("Property coordinates unavailable.");
  }
  const effectiveRadius = trip.radiusKm ?? config.defaultRadiusKm;
  const km = haversineKm(trip.lat, trip.lng, hotel.latitude, hotel.longitude);
  const value = clamp100(100 * Math.max(0, 1 - km / effectiveRadius));
  return {
    value,
    status: "available",
    confidence: 1,
    notes: [`${km.toFixed(2)} km from destination (effective radius ${effectiveRadius} km).`],
  };
}

/** Capacity/bed/room composite (§2.3) with renormalization over known parts. */
export function calculateGroupFitScore(
  hotel: NormalizedAccommodation,
  trip: TripContext,
): MetricValue {
  const required = trip.adults + trip.children;
  const notes: string[] = [];
  const parts: Array<{ weight: number; score: number }> = [];

  if (hotel.capacity !== null) {
    const spare = hotel.capacity - required;
    const score = spare <= 1 ? 100 : Math.max(60, 100 - 10 * (spare - 1));
    parts.push({ weight: 0.5, score });
  } else {
    notes.push("Capacity unknown.");
  }

  const neededBeds = Math.ceil(trip.adults / 2) + trip.children;
  if (hotel.beds !== null) {
    const score = hotel.beds >= neededBeds ? 100 : Math.max(0, 100 - 25 * (neededBeds - hotel.beds));
    parts.push({ weight: 0.3, score });
  } else {
    notes.push("Bed count unknown.");
  }

  if (hotel.bedrooms !== null) {
    const score =
      hotel.bedrooms >= trip.rooms ? 100 : hotel.bedrooms === trip.rooms - 1 ? 60 : 30;
    parts.push({ weight: 0.2, score });
  } else {
    notes.push("Bedroom count unknown.");
  }

  if (parts.length === 0) {
    return unavailable("No capacity, bed, or bedroom data.");
  }
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const value = clamp100(parts.reduce((s, p) => s + (p.weight / totalWeight) * p.score, 0));
  const partial = parts.length < 3;
  return {
    value,
    status: partial ? "partial" : "available",
    confidence: partial ? 0.6 : 1,
    notes,
  };
}

/** Cancellation / instant book / supplier availability composite (§2.4). */
export function calculateFlexibilityScore(
  hotel: NormalizedAccommodation,
  config: EngineConfig,
): MetricValue {
  const notes: string[] = [];
  const parts: Array<{ weight: number; score: number }> = [];

  if (hotel.freeCancellation !== null) {
    parts.push({ weight: 0.5, score: hotel.freeCancellation ? 100 : 0 });
  } else {
    notes.push("Cancellation policy unknown.");
  }
  if (hotel.instantBooking !== null) {
    parts.push({ weight: 0.2, score: hotel.instantBooking ? 100 : 0 });
  } else {
    notes.push("Instant booking status unknown.");
  }
  const supplierCount = hotel.supplierCount ?? (hotel.supplierIds.length || null);
  if (supplierCount !== null) {
    const score = 100 * Math.min(1, Math.log1p(supplierCount) / Math.log1p(config.supplierSaturation));
    parts.push({ weight: 0.3, score });
  } else {
    notes.push("Supplier availability unknown.");
  }

  if (parts.length === 0) {
    return unavailable("No policy or supplier data.");
  }
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const value = clamp100(parts.reduce((s, p) => s + (p.weight / totalWeight) * p.score, 0));
  const partial = parts.length < 3;
  return { value, status: partial ? "partial" : "available", confidence: partial ? 0.6 : 1, notes };
}

/** Evidence completeness, not desirability (§2.5). */
export function calculateDataConfidence(hotel: NormalizedAccommodation): MetricValue {
  const present = (x: unknown) => (x !== null && x !== undefined ? 1 : 0);
  const bedsBedrooms = (present(hotel.beds) + present(hotel.bedrooms)) / 2;
  const policies = (present(hotel.freeCancellation) + present(hotel.instantBooking)) / 2;
  const supplier = hotel.supplierCount !== null || hotel.supplierIds.length > 0 ? 1 : 0;
  const value =
    100 *
    (0.3 * present(hotel.guestRating) +
      0.2 * present(hotel.reviewCount) +
      0.2 * present(hotel.capacity) +
      0.1 * bedsBedrooms +
      0.1 * policies +
      0.1 * supplier);
  return { value: clamp100(value), status: "available", confidence: 1, notes: [] };
}

/** Price-vs-quality value score, only for verified comparable prices (§2.6). */
export function calculateValueScore(
  hotel: NormalizedAccommodation,
  priceMin: number,
  priceMax: number,
  quality: MetricValue,
  config: EngineConfig,
): MetricValue {
  if (hotel.nightlyPrice === null) {
    return unavailable("No comparable live price for this property.");
  }
  const priceScore =
    priceMax === priceMin ? 100 : (100 * (priceMax - hotel.nightlyPrice)) / (priceMax - priceMin);
  if (quality.value === null) {
    return {
      value: clamp100(priceScore),
      status: "partial",
      confidence: 0.6,
      notes: ["Quality unavailable; value reflects price position only."],
    };
  }
  const value = config.valueLambda * priceScore + (1 - config.valueLambda) * quality.value;
  return { value: clamp100(value), status: quality.status, confidence: quality.confidence, notes: [] };
}

export interface PoolMetrics {
  metricsById: Record<string, HotelMetrics>;
  availability: MetricAvailability[];
  activeMetrics: Metric[];
}

/**
 * Compute all metrics for the eligible pool, then decide which metrics are
 * active based on coverage and variation thresholds (§2.7). Value activates
 * only when comparable price coverage clears its own threshold.
 */
export function calculatePoolMetrics(
  hotels: NormalizedAccommodation[],
  trip: TripContext,
  config: EngineConfig,
): PoolMetrics {
  const rated = hotels.filter((h) => h.guestRating !== null);
  const poolMeanRating =
    rated.length >= 3 ? rated.reduce((s, h) => s + (h.guestRating as number), 0) / rated.length : null;

  const priced = hotels.filter((h) => h.nightlyPrice !== null).map((h) => h.nightlyPrice as number);
  const priceCoverage = hotels.length > 0 ? priced.length / hotels.length : 0;
  const valueActive = priceCoverage >= config.valueCoverageThreshold && priced.length >= 2;
  const priceMin = valueActive ? Math.min(...priced) : 0;
  const priceMax = valueActive ? Math.max(...priced) : 0;

  const metricsById: Record<string, HotelMetrics> = {};
  for (const hotel of hotels) {
    const quality = calculateQualityScore(hotel, poolMeanRating, config);
    metricsById[hotel.id] = {
      quality,
      location: calculateLocationScore(hotel, trip, config),
      groupFit: calculateGroupFitScore(hotel, trip),
      flexibility: calculateFlexibilityScore(hotel, config),
      dataConfidence: calculateDataConfidence(hotel),
      value: valueActive
        ? calculateValueScore(hotel, priceMin, priceMax, quality, config)
        : unavailable(
            priceCoverage === 0
              ? "No comparable live prices in this result set."
              : `Comparable price coverage ${(priceCoverage * 100).toFixed(0)}% below threshold.`,
          ),
    };
  }

  const availability: MetricAvailability[] = ALL_METRICS.map((metric) => {
    const values = hotels
      .map((h) => metricsById[h.id][metric].value)
      .filter((v): v is number => v !== null);
    const coverage = hotels.length > 0 ? values.length / hotels.length : 0;
    const variation = interquartileRange(values);
    let status: MetricAvailability["status"] = "available";
    let reason: string | undefined;
    if (coverage < config.metricCoverageThreshold) {
      status = "unavailable";
      reason = `Coverage ${(coverage * 100).toFixed(0)}% below threshold.`;
    } else if (variation < config.metricVariationThreshold) {
      status = "unavailable";
      reason = `Variation too low to differentiate candidates.`;
    }
    return { metric, status, coverage, variation, reason };
  });

  // dataConfidence stays active whenever covered, even at low variation — it
  // participates at modest weight and drives disclosure (§2.5).
  const activeMetrics = availability
    .filter((a) =>
      a.metric === "dataConfidence"
        ? a.coverage >= config.metricCoverageThreshold
        : a.status === "available",
    )
    .map((a) => a.metric);

  return { metricsById, availability, activeMetrics };
}

export function interquartileRange(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return q(0.75) - q(0.25);
}
