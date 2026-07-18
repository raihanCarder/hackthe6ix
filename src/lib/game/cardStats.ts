import { createRng, hashString } from "@/lib/engine/seed";
import type { NormalizedAccommodation } from "@/lib/engine/types";

/**
 * Presentation-layer football-card stats (documentation/ideas/IDEA.md "Card Stats"). Derived
 * from live attributes for flavor and card visuals — they NEVER feed the
 * recommendation engine, and rarity never affects who wins.
 */

export interface CardStats {
  vibe: number; // guest rating
  legacy: number; // review count
  value: number; // relative trip price
  flex: number; // cancellation / instant book / suppliers
  squad: number; // guests, bedrooms, beds
  chaos: number; // property-type rarity + cosmetic seed
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
  cosmeticSeed: string,
): CardStats {
  const vibe = hotel.guestRating !== null ? clampStat(hotel.guestRating * 10) : 50;

  const legacy =
    hotel.reviewCount !== null
      ? clampStat(99 * Math.min(1, Math.log1p(hotel.reviewCount) / Math.log1p(3000)))
      : 40;

  let value = 50;
  if (hotel.nightlyPrice !== null && prices && prices.max > prices.min) {
    value = clampStat(20 + 79 * ((prices.max - hotel.nightlyPrice) / (prices.max - prices.min)));
  }

  let flex = 0;
  flex += hotel.freeCancellation ? 40 : 0;
  flex += hotel.instantBooking ? 25 : 0;
  const suppliers = hotel.supplierCount ?? hotel.supplierIds.length;
  flex += 34 * Math.min(1, Math.log1p(suppliers) / Math.log1p(5));
  flex = clampStat(Math.max(flex, 15));

  const capacityPart = Math.min(1, (hotel.capacity ?? 2) / 8);
  const bedroomPart = Math.min(1, (hotel.bedrooms ?? 1) / 4);
  const bedPart = Math.min(1, (hotel.beds ?? 1) / 5);
  const squad = clampStat(99 * (0.5 * capacityPart + 0.25 * bedroomPart + 0.25 * bedPart));

  const typeRarityBonus: Record<string, number> = {
    hotel: 0,
    apartment: 8,
    bnb: 16,
    hostel: 12,
  };
  const chaosRng = createRng(`chaos:${hotel.id}:${cosmeticSeed}`);
  const chaos = clampStat(
    25 + chaosRng() * 55 + (typeRarityBonus[hotel.propertyType ?? "hotel"] ?? 20),
  );

  return { vibe, legacy, value, flex, squad, chaos };
}

export function overallRating(stats: CardStats): number {
  return clampStat(
    0.28 * stats.vibe +
      0.18 * stats.legacy +
      0.18 * stats.value +
      0.14 * stats.flex +
      0.12 * stats.squad +
      0.1 * stats.chaos,
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
