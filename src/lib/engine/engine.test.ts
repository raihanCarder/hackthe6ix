import { describe, expect, it } from "vitest";
import { applyHardConstraints } from "./constraints";
import {
  calculateQualityScore,
  calculatePoolMetrics,
  haversineKm,
  interquartileRange,
} from "./metrics";
import {
  applyAnswerEffects,
  normalizePreferencePoints,
  profileWeights,
  selectAdaptiveQuestions,
} from "./questionnaire";
import { createRng, hashString, sampleDirichlet, stableStringify } from "./seed";
import { buildMetricMatrix, pairwiseFromUtilities, runMonteCarlo } from "./simulate";
import { runEngine } from "./index";
import type { NormalizedAccommodation, TripContext } from "./types";
import { DEFAULT_ENGINE_CONFIG } from "./types";

const config = DEFAULT_ENGINE_CONFIG;

function hotel(overrides: Partial<NormalizedAccommodation> & { id: string }): NormalizedAccommodation {
  return {
    bookingUrl: `https://example.com/book/${overrides.id}`,
    supplierIds: ["s1", "s2"],
    supplierLinks: [],
    supplierCount: 2,
    name: overrides.id,
    propertyType: "hotel",
    address: "123 Test St",
    latitude: 43.65,
    longitude: -79.38,
    distanceKm: null,
    guestRating: 8.5,
    stars: 4,
    reviewCount: 500,
    capacity: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    freeCancellation: true,
    instantBooking: false,
    thumbnailUrl: null,
    nightlyPrice: 200,
    provenance: {},
    ...overrides,
  };
}

const trip: TripContext = {
  destinationLabel: "Toronto",
  lat: 43.6532,
  lng: -79.3832,
  checkin: "2026-08-10",
  checkout: "2026-08-13",
  adults: 2,
  children: 0,
  rooms: 1,
  minNightly: null,
  maxNightly: null,
  radiusKm: null,
  currency: "CAD",
};

function makePool(count: number): NormalizedAccommodation[] {
  const rng = createRng("fixture-pool");
  return Array.from({ length: count }, (_, i) =>
    hotel({
      id: `h${String(i).padStart(2, "0")}`,
      guestRating: 6 + rng() * 4,
      reviewCount: Math.floor(rng() * 3000),
      nightlyPrice: 90 + Math.floor(rng() * 400),
      latitude: 43.6532 + (rng() - 0.5) * 0.1,
      longitude: -79.3832 + (rng() - 0.5) * 0.1,
      capacity: 2 + Math.floor(rng() * 4),
      freeCancellation: rng() > 0.4,
      instantBooking: rng() > 0.5,
      supplierCount: 1 + Math.floor(rng() * 5),
    }),
  );
}

describe("seeded randomness", () => {
  it("same seed produces identical streams", () => {
    const a = createRng("abc");
    const b = createRng("abc");
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("dirichlet samples sum to 1 and stay near base weights at high concentration", () => {
    const rng = createRng("dirichlet");
    const base = [0.4, 0.3, 0.2, 0.1];
    const sums = [0, 0, 0, 0];
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const s = sampleDirichlet(rng, base.map((w) => w * 200));
      expect(s.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9);
      s.forEach((v, j) => (sums[j] += v));
    }
    sums.forEach((total, j) => expect(total / n).toBeCloseTo(base[j], 1));
  });

  it("stableStringify is key-order independent", () => {
    expect(stableStringify({ a: 1, b: [{ y: 2, x: 3 }] })).toBe(
      stableStringify({ b: [{ x: 3, y: 2 }], a: 1 }),
    );
    expect(hashString(stableStringify({ a: 1, b: 2 }))).toBe(
      hashString(stableStringify({ b: 2, a: 1 })),
    );
  });
});

describe("quality shrinkage (§2.1)", () => {
  it("shrinks low-review ratings toward the pool mean", () => {
    const few = calculateQualityScore(hotel({ id: "few", guestRating: 9.5, reviewCount: 3 }), 8, config);
    const many = calculateQualityScore(
      hotel({ id: "many", guestRating: 9.0, reviewCount: 3000 }),
      8,
      config,
    );
    expect(many.value!).toBeGreaterThan(few.value!);
  });

  it("is unavailable without a rating and never inferred from stars", () => {
    const result = calculateQualityScore(
      hotel({ id: "x", guestRating: null, stars: 5 }),
      8,
      config,
    );
    expect(result.status).toBe("unavailable");
    expect(result.value).toBeNull();
  });
});

describe("haversine (§2.2)", () => {
  it("matches a known distance (Toronto to Montreal ≈ 504 km)", () => {
    const km = haversineKm(43.6532, -79.3832, 45.5019, -73.5674);
    expect(km).toBeGreaterThan(495);
    expect(km).toBeLessThan(515);
  });

  it("is zero for identical points", () => {
    expect(haversineKm(43.65, -79.38, 43.65, -79.38)).toBeCloseTo(0, 9);
  });
});

describe("hard constraints (§1.3)", () => {
  it("excludes insufficient known capacity with a machine-readable reason", () => {
    const result = applyHardConstraints(
      [hotel({ id: "small", capacity: 2 })],
      { ...trip, adults: 4, children: 1 },
      config,
    );
    expect(result.eligible).toHaveLength(0);
    expect(result.excluded[0].reasons).toContain("INSUFFICIENT_CAPACITY");
  });

  it("fails closed on unknown capacity only for larger parties", () => {
    const unknownCap = hotel({ id: "u", capacity: null });
    const bigParty = applyHardConstraints([unknownCap], { ...trip, adults: 5 }, config);
    expect(bigParty.excluded[0].reasons).toContain("UNKNOWN_CAPACITY_FAIL_CLOSED");
    const couple = applyHardConstraints([unknownCap], trip, config);
    expect(couple.eligible).toHaveLength(1);
  });

  it("enforces an explicit radius as a hard boundary", () => {
    const far = hotel({ id: "far", latitude: 44.5, longitude: -80.5 });
    const result = applyHardConstraints([far], { ...trip, radiusKm: 5 }, config);
    expect(result.excluded[0].reasons).toContain("OUTSIDE_BOUNDARY");
  });

  it("applies price limits only when a comparable price exists", () => {
    const noPrice = hotel({ id: "np", nightlyPrice: null });
    const pricey = hotel({ id: "p", nightlyPrice: 900 });
    const result = applyHardConstraints([noPrice, pricey], { ...trip, maxNightly: 300 }, config);
    expect(result.eligible.map((h) => h.id)).toEqual(["np"]);
    expect(result.excluded[0].reasons).toContain("OUTSIDE_PRICE_LIMITS");
  });
});

describe("metric availability (§2.7)", () => {
  it("deactivates value when price coverage is below threshold", () => {
    const pool = makePool(10).map((h, i) => ({ ...h, nightlyPrice: i < 3 ? h.nightlyPrice : null }));
    const { activeMetrics } = calculatePoolMetrics(pool, trip, config);
    expect(activeMetrics).not.toContain("value");
  });

  it("computes IQR", () => {
    expect(interquartileRange([1, 2, 3, 4, 5, 6, 7, 8])).toBeCloseTo(3.5, 5);
    expect(interquartileRange([5])).toBe(0);
  });
});

describe("questionnaire (§3–4)", () => {
  it("skips the value question when value is inactive", () => {
    const questions = selectAdaptiveQuestions({
      activeMetrics: ["quality", "location", "groupFit", "flexibility", "dataConfidence"],
      availability: [],
      partySize: 2,
    });
    const priority = questions.find((q) => q.id === "q_priority")!;
    expect(priority.options.map((o) => o.id)).not.toContain("priority_value");
    expect(questions.find((q) => q.id === "q_tradeoff_value")).toBeUndefined();
  });

  it("reproduces the §4 numerical example", () => {
    const { points, weights } = applyAnswerEffects(
      [
        { questionId: "q_priority", optionIds: ["priority_location"] },
        { questionId: "q_trip_type", optionIds: ["trip_event"] },
        { questionId: "q_flexibility", optionIds: ["flex_change"] },
        { questionId: "q_tradeoff_location", optionIds: ["tl_small"] },
        { questionId: "q_style", optionIds: ["style_safe"] },
      ],
      ["quality", "location", "groupFit", "flexibility", "dataConfidence", "value"],
      config,
    );
    expect(points.quality).toBe(40);
    expect(points.location).toBe(70);
    expect(points.groupFit).toBe(10);
    expect(points.flexibility).toBe(40);
    expect(points.dataConfidence).toBe(35);
    expect(points.value).toBe(10);
    expect(weights.location!).toBeCloseTo(70 / 205, 10);
  });

  it("normalizes weights to sum 1 and rejects non-positive totals", () => {
    const weights = normalizePreferencePoints({ quality: 30, location: 10 });
    expect(weights.quality! + weights.location!).toBeCloseTo(1, 12);
    expect(() => normalizePreferencePoints({})).toThrow();
  });

  it("renormalizes fallback profiles over active metrics", () => {
    const weights = profileWeights("best_overall", ["quality", "location"]);
    expect(weights.quality!).toBeCloseTo(35 / 65, 10);
    expect(weights.location!).toBeCloseTo(30 / 65, 10);
  });
});

describe("monte carlo (§6–7)", () => {
  it("pairwise probabilities are symmetric and sum to 1 with ties", () => {
    const pool = makePool(6);
    const { metricsById, activeMetrics } = calculatePoolMetrics(pool, trip, config);
    const ids = pool.map((h) => h.id).sort();
    const matrix = buildMetricMatrix(ids, metricsById, activeMetrics);
    const weights = profileWeights("best_overall", activeMetrics);
    const mc = runMonteCarlo(matrix, weights, {
      count: 1000,
      concentration: 40,
      seed: "pairwise-test",
      algorithmVersion: "test",
    });
    const p = pairwiseFromUtilities(mc, 0, 1);
    expect(p.probabilityA + p.probabilityB + p.tieProbability).toBeCloseTo(1, 9);
    const identical = pairwiseFromUtilities(mc, 2, 2);
    expect(identical.tieProbability).toBe(1);
  });
});

describe("runEngine end-to-end", () => {
  it("is deterministic for identical inputs", () => {
    const pool = makePool(20);
    const input = {
      trip,
      hotels: pool,
      answers: [
        { questionId: "q_priority", optionIds: ["priority_location"] },
        { questionId: "q_style", optionIds: ["style_safe"] },
      ],
      config: { simulationCount: 500 },
    };
    const a = runEngine(input);
    const b = runEngine(input);
    expect(a.seed).toBe(b.seed);
    expect(a.championId).toBe(b.championId);
    expect(a.ranking).toEqual(b.ranking);
    expect(a.regret).toEqual(b.regret);
  });

  it("changes seed when answers change", () => {
    const pool = makePool(12);
    const a = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 200 } });
    const b = runEngine({
      trip,
      hotels: pool,
      answers: [{ questionId: "q_priority", optionIds: ["priority_quality"] }],
      config: { simulationCount: 200 },
    });
    expect(a.seed).not.toBe(b.seed);
  });

  it("first-place probabilities sum to ~1 and champion leads", () => {
    const pool = makePool(16);
    const result = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 1000 } });
    const total = result.ranking.reduce((s, h) => s + h.firstPlaceProbability, 0);
    expect(total).toBeGreaterThan(0.999);
    expect(total).toBeLessThan(1.001);
    expect(result.ranking[0].hotelId).toBe(result.championId);
    expect(result.championWinProbability).toBeGreaterThanOrEqual(
      result.ranking[1].firstPlaceProbability,
    );
  });

  it("throws when fewer than two eligible hotels remain", () => {
    expect(() =>
      runEngine({ trip: { ...trip, adults: 8 }, hotels: makePool(3), answers: [] }),
    ).toThrow();
  });
});
