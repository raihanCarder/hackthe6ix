import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/engine";
import { createRng } from "@/lib/engine/seed";
import type { NormalizedAccommodation, TripContext } from "@/lib/engine/types";
import { buildBracketContenders } from "@/lib/game/bracket";
import { simulateTournament, type MatchResult } from "@/lib/game/matchSim";
import { buildPlaybackTimeline, clubAbbrev, deriveTimeline } from "./matchPlayback";

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

function makePool(count: number, seed = "playback-pool"): NormalizedAccommodation[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: `p${String(i).padStart(2, "0")}`,
    bookingUrl: `https://example.com/${i}`,
    supplierIds: ["a", "b"],
    supplierLinks: [],
    supplierCount: 1 + Math.floor(rng() * 5),
    name: `Hotel ${i}`,
    propertyType: "hotel",
    address: `${i} Test St`,
    countryCode: "CA",
    countryName: "Canada",
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

function allMatches(): MatchResult[] {
  const pool = makePool(24);
  const engine = runEngine({ trip, hotels: pool, answers: [], config: { simulationCount: 200 } });
  const utilityById = new Map(engine.ranking.map((r) => [r.hotelId, r.deterministicScore]));
  const hotelsById = new Map(pool.map((h) => [h.id, h]));
  const plan = buildBracketContenders({
    eligible: pool,
    ranking: engine.ranking,
    userPropertyIds: [],
    seed: "pb",
  });
  const bracket = simulateTournament({
    groups: plan.groups,
    championId: engine.championId,
    utilityById,
    hotelsById,
    seed: "pb",
  });
  return [
    ...bracket.groups.flatMap((g) => g.matches),
    ...bracket.knockout.flatMap((r) => r.matches),
  ];
}

describe("buildPlaybackTimeline", () => {
  const matches = allMatches();

  it("covers a full bracket of matches", () => {
    expect(matches.length).toBeGreaterThan(20);
  });

  it("goal events sum exactly to the scoreline and the score climbs to the final", () => {
    for (const match of matches) {
      const timeline = buildPlaybackTimeline(match);
      const goals = timeline.events.filter((e) => e.kind === "goal");
      const homeGoals = goals.filter((e) => e.side === "home").length;
      const awayGoals = goals.filter((e) => e.side === "away").length;
      expect(homeGoals).toBe(match.homeGoals);
      expect(awayGoals).toBe(match.awayGoals);

      const last = timeline.events[timeline.events.length - 1];
      // Running score after the last event equals the true scoreline.
      const finalHome = Math.max(...timeline.events.map((e) => e.homeScore), 0);
      const finalAway = Math.max(...timeline.events.map((e) => e.awayScore), 0);
      expect(finalHome).toBe(match.homeGoals);
      expect(finalAway).toBe(match.awayGoals);
      expect(last).toBeDefined();
      expect(timeline.finalHome).toBe(match.homeGoals);
      expect(timeline.finalAway).toBe(match.awayGoals);
    }
  });

  it("timestamps are strictly increasing and within the duration", () => {
    const durationMs = 9000;
    for (const match of matches) {
      const timeline = buildPlaybackTimeline(match, { durationMs });
      let prev = -1;
      for (const e of timeline.events) {
        expect(e.atMs).toBeGreaterThan(prev);
        expect(e.atMs).toBeGreaterThanOrEqual(0);
        expect(e.atMs).toBeLessThanOrEqual(durationMs);
        expect(e.minute).toBeGreaterThanOrEqual(1);
        expect(e.minute).toBeLessThanOrEqual(90);
        prev = e.atMs;
      }
    }
  });

  it("keeps momentum within [-1, 1] across the whole playback", () => {
    for (const match of matches) {
      const timeline = buildPlaybackTimeline(match, { durationMs: 9000 });
      for (let t = 0; t <= 9000; t += 150) {
        const m = timeline.momentumAt(t);
        expect(m).toBeGreaterThanOrEqual(-1);
        expect(m).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic for the same match", () => {
    const a = buildPlaybackTimeline(matches[0]);
    const b = buildPlaybackTimeline(matches[0]);
    expect(a.events).toEqual(b.events);
  });
});

describe("deriveTimeline (legacy fallback)", () => {
  it("synthesizes goal events for a bracket saved without canonical goals", () => {
    // A pre-change match: highlights carry no `kind`, only flavor + full time.
    const legacy: MatchResult = {
      round: "group",
      group: "A",
      homeId: "home",
      awayId: "away",
      homeGoals: 2,
      awayGoals: 1,
      winnerId: "home",
      highlights: [
        { minute: 12, propertyId: "home", text: "Free Cancellation Shield holds." },
        { minute: 44, propertyId: "away", text: "Transfer Window surge." },
        { minute: 90, propertyId: "home", text: "Full time! home takes the tie." },
      ],
    };

    const derived = deriveTimeline(legacy, "seed");
    const goals = derived.filter((h) => h.kind === "goal");
    expect(goals.filter((h) => h.propertyId === "home")).toHaveLength(2);
    expect(goals.filter((h) => h.propertyId === "away")).toHaveLength(1);
    // Original flavor text is preserved as chances.
    expect(derived.some((h) => h.kind === "chance" && h.text.includes("Transfer Window"))).toBe(true);

    const timeline = buildPlaybackTimeline(legacy, { seed: "seed" });
    expect(timeline.finalHome).toBe(2);
    expect(timeline.finalAway).toBe(1);
    const finalHome = Math.max(...timeline.events.map((e) => e.homeScore));
    const finalAway = Math.max(...timeline.events.map((e) => e.awayScore));
    expect(finalHome).toBe(2);
    expect(finalAway).toBe(1);
  });

  it("leaves canonical brackets untouched", () => {
    const canonical: MatchResult = {
      round: "group",
      group: "A",
      homeId: "home",
      awayId: "away",
      homeGoals: 1,
      awayGoals: 0,
      winnerId: "home",
      highlights: [
        { minute: 30, propertyId: "home", kind: "goal", text: "GOAL! home slots it home!" },
        { minute: 90, propertyId: "home", kind: "chance", text: "Full time!" },
      ],
    };
    const derived = deriveTimeline(canonical);
    expect(derived.filter((h) => h.kind === "goal")).toHaveLength(1);
  });
});

describe("clubAbbrev", () => {
  it("makes a 3-letter broadcast tag", () => {
    expect(clubAbbrev("The Grand Plaza")).toBe("TGP");
    expect(clubAbbrev("Hilton")).toBe("HIL");
    expect(clubAbbrev(null)).toBe("———");
  });
});
