import { describe, expect, it } from "vitest";
import type { WorldCity } from "@/lib/data/worldCities";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { collectGlobalOpponents } from "./globalOpponents";

const cities: WorldCity[] = ["Canada", "France", "Japan", "Brazil", "Kenya"].map(
  (country, index) => ({ city: `City ${index}`, country, lat: index, lng: index }),
);

function hotel(id: string, guestRating = 8, reviewCount = 100): NormalizedAccommodation {
  return {
    id,
    bookingUrl: `https://example.com/${id}`,
    supplierIds: [],
    supplierLinks: [],
    supplierCount: 1,
    name: `Hotel ${id}`,
    propertyType: "hotel",
    address: "Test address",
    countryCode: null,
    countryName: null,
    latitude: null,
    longitude: null,
    distanceKm: null,
    guestRating,
    stars: null,
    reviewCount,
    capacity: null,
    bedrooms: null,
    beds: null,
    bathrooms: null,
    freeCancellation: null,
    instantBooking: null,
    thumbnailUrl: null,
    nightlyPrice: 100,
    provenance: {},
  };
}

describe("collectGlobalOpponents", () => {
  it("uses a reserve country when an initial city has no hotels", async () => {
    const hotelsByCountry: Record<string, NormalizedAccommodation[]> = {
      Canada: [hotel("ca")],
      France: [],
      Japan: [hotel("jp")],
      Brazil: [hotel("br")],
    };

    const result = await collectGlobalOpponents({
      cities,
      targetCount: 3,
      excludedPropertyIds: [],
      reserveBatchSize: 1,
      search: async (city) => ({ hotels: hotelsByCountry[city.country] ?? [] }),
    });

    expect(result.opponents.map((entry) => entry.id)).toEqual(["ca", "jp", "br"]);
    expect(result.opponentCities.map((entry) => entry.country)).toEqual([
      "Canada",
      "Japan",
      "Brazil",
    ]);
    expect(result.attemptedCityCount).toBe(4);
  });

  it("replaces duplicate properties and tolerates a failed provider request", async () => {
    const result = await collectGlobalOpponents({
      cities,
      targetCount: 2,
      excludedPropertyIds: ["owned"],
      reserveBatchSize: 1,
      search: async (city) => {
        if (city.country === "Canada") return { hotels: [hotel("owned")] };
        if (city.country === "France") throw new Error("provider timeout");
        return { hotels: [hotel(city.country.toLowerCase())] };
      },
    });

    expect(result.opponents.map((entry) => entry.id)).toEqual(["japan", "brazil"]);
    expect(new Set(result.opponents.map((entry) => entry.id)).size).toBe(2);
    expect(result.attemptedCityCount).toBe(4);
  });

  it("chooses the strongest unused hotel deterministically", async () => {
    const result = await collectGlobalOpponents({
      cities: cities.slice(0, 1),
      targetCount: 1,
      excludedPropertyIds: ["top"],
      search: async () => ({
        hotels: [hotel("low", 7, 500), hotel("top", 10, 2_000), hotel("best", 9, 300)],
      }),
    });

    expect(result.opponents.map((entry) => entry.id)).toEqual(["best"]);
  });
});
