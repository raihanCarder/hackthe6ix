import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/engine";
import { createRng } from "@/lib/engine/seed";
import type { NormalizedAccommodation, TripContext } from "@/lib/engine/types";
import { buildBracketContenders } from "./bracket";
import {
  assignRarity,
  collectibleOverallRating,
  computeCardStats,
  deriveCosmeticSeed,
  poolPriceContext,
} from "./cardStats";
import { simulateTournament } from "./matchSim";
import { computeTournamentRewards } from "./rewards";

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

function makePool(count: number, seed = "game-pool"): NormalizedAccommodation[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`,
    bookingUrl: `https://example.com/${i}`,
    supplierIds: ["a", "b"],
    supplierLinks: [],
    supplierCount: 1 + Math.floor(rng() * 5),
    name: `Hotel ${i}`,
    propertyType: ["hotel", "apartment", "hostel", "bnb"][Math.floor(rng() * 4)],
    address: `${i} Test St`,
    latitude: 43.6532 + (rng() - 0.5) * 0.1,
    longitude: -79.3832 + (rng() - 0.5) * 0.1,
    distanceKm: null,
    guestRating: Math.round((6 + rng() * 4) * 10) / 10,
    stars: 3,
    reviewCount: Math.floor(rng() * 3000),
    capacity: 2 + Math.floor(rng() * 5),
    bedrooms: 1 + Math.floor(rng() * 3),
    beds: 1 + Math.floor(rng() * 4),
    bathrooms: 1,
    freeCancellation: rng() > 0.5,
    instantBooking: rng() > 0.5,
    thumbnailUrl: null,
    nightlyPrice: 80 + Math.floor(rng() * 350),
    provenance: {},
  }));
}

describe("card stats and rarity", () => {
  it("rarity is deterministic from propertyId + cosmeticSeed", () => {
    expect(assignRarity("prop1", "seedA")).toBe(assignRarity("prop1", "seedA"));
    const seeds = Array.from({ length: 400 }, (_, i) => assignRarity(`p${i}`, "x"));
    const legendary = seeds.filter((r) => r === "legendary").length;
    expect(legendary).toBeGreaterThan(0);
    expect(legendary).toBeLessThan(60);
  });

  it("cosmetic seed derivation is deterministic", () => {
    expect(deriveCosmeticSeed("pack1", "prop1")).toBe(deriveCosmeticSeed("pack1", "prop1"));
    expect(deriveCosmeticSeed("pack1", "prop1")).not.toBe(deriveCosmeticSeed("pack2", "prop1"));
  });

  it("cheaper hotels get higher VALUE within the pool", () => {
    const pool = makePool(10);
    const prices = poolPriceContext(pool)!;
    const cheap = computeCardStats({ ...pool[0], nightlyPrice: prices.min }, prices);
    const dear = computeCardStats({ ...pool[0], nightlyPrice: prices.max }, prices);
    expect(cheap.value).toBeGreaterThan(dear.value);
  });

  it("stats stay within 1–99", () => {
    const pool = makePool(20);
    const prices = poolPriceContext(pool);
    for (const hotel of pool) {
      const stats = computeCardStats(hotel, prices);
      for (const value of Object.values(stats)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(99);
      }
    }
  });

  it("keeps collectible OVR inside its rarity band", () => {
    const stats = computeCardStats(makePool(1)[0], null);
    expect(collectibleOverallRating(stats, "common")).toBeGreaterThanOrEqual(40);
    expect(collectibleOverallRating(stats, "common")).toBeLessThanOrEqual(59);
    expect(collectibleOverallRating(stats, "rare")).toBeGreaterThanOrEqual(60);
    expect(collectibleOverallRating(stats, "rare")).toBeLessThanOrEqual(69);
    expect(collectibleOverallRating(stats, "epic")).toBeGreaterThanOrEqual(70);
    expect(collectibleOverallRating(stats, "epic")).toBeLessThanOrEqual(89);
    expect(collectibleOverallRating(stats, "legendary")).toBeGreaterThanOrEqual(90);
    expect(collectibleOverallRating(stats, "legendary")).toBeLessThanOrEqual(99);
  });

  it("preserves hotel quality ordering within the same rarity", () => {
    const weak = { comfort: 20, amenities: 20, luxury: 20, value: 20, location: 20, service: 20 };
    const strong = { comfort: 90, amenities: 90, luxury: 90, value: 90, location: 90, service: 90 };
    expect(collectibleOverallRating(strong, "legendary")).toBeGreaterThan(
      collectibleOverallRating(weak, "legendary"),
    );
  });
});

describe("bracket construction", () => {
  it("builds 4 groups of 4 with champion and user cards included", () => {
    const pool = makePool(30);
    const engine = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 300 } });
    const userIds = pool.slice(0, 5).map((h) => h.id);
    const plan = buildBracketContenders({
      eligible: pool,
      ranking: engine.ranking,
      userPropertyIds: userIds,
      seed: "test-seed",
    });
    expect(plan.contenderIds).toHaveLength(16);
    expect(new Set(plan.contenderIds).size).toBe(16);
    expect(plan.groups).toHaveLength(4);
    for (const group of plan.groups) expect(group).toHaveLength(4);
    expect(plan.contenderIds).toContain(engine.championId);
    for (const id of userIds) expect(plan.contenderIds).toContain(id);
  });

  it("shrinks gracefully for small pools", () => {
    const pool = makePool(9);
    const engine = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 200 } });
    const plan = buildBracketContenders({
      eligible: pool,
      ranking: engine.ranking,
      userPropertyIds: [],
      seed: "small",
    });
    expect(plan.contenderIds).toHaveLength(8);
    expect(plan.groups).toHaveLength(2);
  });
});

describe("champion invariant (the hybrid rule)", () => {
  it("engine #1 wins the tournament across 50 different seeds", () => {
    const pool = makePool(24, "invariant-pool");
    const engine = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 300 } });
    const utilityById = new Map(engine.ranking.map((r) => [r.hotelId, r.deterministicScore]));
    const hotelsById = new Map(pool.map((h) => [h.id, h]));

    for (let i = 0; i < 50; i++) {
      const seed = `invariant-${i}`;
      const plan = buildBracketContenders({
        eligible: pool,
        ranking: engine.ranking,
        userPropertyIds: pool.slice(3, 8).map((h) => h.id),
        seed,
      });
      const bracket = simulateTournament({
        groups: plan.groups,
        championId: engine.championId,
        utilityById,
        hotelsById,
        seed,
      });
      expect(bracket.championId).toBe(engine.championId);
    }
  });

  it("is fully deterministic for the same seed", () => {
    const pool = makePool(20, "det-pool");
    const engine = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 200 } });
    const utilityById = new Map(engine.ranking.map((r) => [r.hotelId, r.deterministicScore]));
    const hotelsById = new Map(pool.map((h) => [h.id, h]));
    const plan = buildBracketContenders({
      eligible: pool,
      ranking: engine.ranking,
      userPropertyIds: [],
      seed: "det",
    });
    const run = () =>
      simulateTournament({
        groups: plan.groups,
        championId: engine.championId,
        utilityById,
        hotelsById,
        seed: "det",
      });
    expect(run()).toEqual(run());
  });

  it("large utility gaps cannot be flipped by noise", () => {
    const pool = makePool(16, "gap-pool");
    const utilityById = new Map<string, number>(pool.map((h, i) => [h.id, i < 8 ? 90 : 40]));
    const hotelsById = new Map(pool.map((h) => [h.id, h]));
    const strongIds = new Set(pool.slice(0, 8).map((h) => h.id));
    const groups = [0, 1, 2, 3].map((g) =>
      [pool[g * 2], pool[g * 2 + 1], pool[8 + g * 2], pool[9 + g * 2]].map((h) => h.id),
    );
    const bracket = simulateTournament({
      groups,
      championId: pool[0].id,
      utilityById,
      hotelsById,
      seed: "gaps",
    });
    for (const group of bracket.groups) {
      for (const match of group.matches) {
        const homeStrong = strongIds.has(match.homeId);
        const awayStrong = strongIds.has(match.awayId);
        if (homeStrong !== awayStrong) {
          expect(strongIds.has(match.winnerId)).toBe(true);
        }
      }
    }
  });
});

describe("rewards", () => {
  it("grants MVP trophy only when a user card wins the tournament", () => {
    const pool = makePool(16, "rewards-pool");
    const engine = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 200 } });
    const utilityById = new Map(engine.ranking.map((r) => [r.hotelId, r.deterministicScore]));
    const hotelsById = new Map(pool.map((h) => [h.id, h]));
    const plan = buildBracketContenders({
      eligible: pool,
      ranking: engine.ranking,
      userPropertyIds: [engine.championId],
      seed: "rw",
    });
    const bracket = simulateTournament({
      groups: plan.groups,
      championId: engine.championId,
      utilityById,
      hotelsById,
      seed: "rw",
    });

    const winning = computeTournamentRewards(bracket, [engine.championId]);
    expect(winning.userWon).toBe(true);
    expect(winning.cardOutcomes[0].becameMvp).toBe(true);
    expect(winning.cardOutcomes[0].trophies).toBe(1);

    const losingIds = pool.map((h) => h.id).filter((id) => id !== engine.championId).slice(0, 3);
    const losing = computeTournamentRewards(bracket, losingIds);
    expect(losing.userWon).toBe(false);
    expect(losing.cardOutcomes.every((c) => !c.becameMvp)).toBe(true);
    expect(losing.userXp).toBeGreaterThan(0);
  });
});
