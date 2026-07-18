import { createRng, hashString } from "@/lib/engine/seed";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/types";
import type { NormalizedAccommodation } from "@/lib/engine/types";

/**
 * Presentation-layer hotel-card stats (documentation/ideas/IDEA.md "Card Stats"). Derived
 * from live attributes for flavor and card visuals — they NEVER feed the
 * recommendation engine, and rarity never affects who wins.
 */

export interface CardStats {
  comfort: number; // guest rating, shrunk toward neutral by review count
  amenities: number; // guests, bedrooms, beds
  luxury: number; // star rating
  value: number; // relative trip price
  location: number; // distance from destination
  service: number; // cancellation / instant book / suppliers
}

export type Rarity = "common" | "rare" | "epic" | "legendary";

const clampStat = (x: number) => Math.max(1, Math.min(99, Math.round(x)));

export interface PoolPriceContext {
  min: number;
  max: number;
}

export function poolPriceContext(pool: NormalizedAccommodation[]): PoolPriceContext | null {
  const prices = pool.map((h) => h.nightlyPrice).filter((p): p is number => p !== null);
  if (prices.length < 2) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function computeCardStats(
  hotel: NormalizedAccommodation,
  prices: PoolPriceContext | null,
): CardStats {
  let comfort = 50;
  if (hotel.guestRating !== null) {
    const n = hotel.reviewCount ?? 8;
    const m = 25; // pseudo-count for the neutral-50 prior — mirrors the engine's quality shrinkage
    const adjusted = (n / (n + m)) * (hotel.guestRating * 10) + (m / (n + m)) * 50;
    comfort = clampStat(adjusted);
  }

  const capacityPart = Math.min(1, (hotel.capacity ?? 2) / 8);
  const bedroomPart = Math.min(1, (hotel.bedrooms ?? 1) / 4);
  const bedPart = Math.min(1, (hotel.beds ?? 1) / 5);
  const amenities = clampStat(99 * (0.5 * capacityPart + 0.25 * bedroomPart + 0.25 * bedPart));

  const luxury = hotel.stars !== null ? clampStat(20 + hotel.stars * 16) : 50;

  let value = 50;
  if (hotel.nightlyPrice !== null && prices && prices.max > prices.min) {
    value = clampStat(20 + 79 * ((prices.max - hotel.nightlyPrice) / (prices.max - prices.min)));
  }

  const location =
    hotel.distanceKm !== null
      ? clampStat(100 * Math.max(0, 1 - hotel.distanceKm / DEFAULT_ENGINE_CONFIG.defaultRadiusKm))
      : 50;

  let service = 0;
  service += hotel.freeCancellation ? 40 : 0;
  service += hotel.instantBooking ? 25 : 0;
  const suppliers = hotel.supplierCount ?? hotel.supplierIds.length;
  service += 34 * Math.min(1, Math.log1p(suppliers) / Math.log1p(5));
  service = clampStat(Math.max(service, 15));

  return { comfort, amenities, luxury, value, location, service };
}

export function overallRating(stats: CardStats): number {
  return clampStat(
    0.26 * stats.comfort +
      0.2 * stats.value +
      0.2 * stats.location +
      0.14 * stats.luxury +
      0.12 * stats.amenities +
      0.08 * stats.service,
  );
}

/**
 * Deterministic rarity from propertyId + cosmeticSeed (documentation/ideas/IDEA.md test plan).
 * Distribution: 50% common, 30% rare, 15% epic, 5% legendary.
 */
export function assignRarity(stay22PropertyId: string, cosmeticSeed: string): Rarity {
  const roll = createRng(`rarity:${stay22PropertyId}:${cosmeticSeed}`)();
  if (roll < 0.05) return "legendary";
  if (roll < 0.2) return "epic";
  if (roll < 0.5) return "rare";
  return "common";
}

export function deriveCosmeticSeed(packSeed: string, stay22PropertyId: string): string {
  return hashString(`cosmetic:${packSeed}:${stay22PropertyId}`).slice(0, 16);
}
