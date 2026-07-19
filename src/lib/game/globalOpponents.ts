import type { WorldCity } from "@/lib/data/worldCities";
import type { NormalizedAccommodation } from "@/lib/engine/types";

interface OpponentSearchResult {
  hotels: NormalizedAccommodation[];
}

interface CollectGlobalOpponentsArgs {
  cities: WorldCity[];
  targetCount: number;
  excludedPropertyIds: Iterable<string>;
  search: (city: WorldCity) => Promise<OpponentSearchResult>;
  reserveBatchSize?: number;
}

export interface CollectedGlobalOpponents {
  opponents: NormalizedAccommodation[];
  opponentCities: WorldCity[];
  attemptedCityCount: number;
}

/**
 * Fill a Global Cup roster from a seeded list of unique-country cities.
 *
 * The first request wave contains exactly the required roster size. If a
 * provider response is empty, invalid, duplicated, or fails, reserve countries
 * are searched in small waves until the roster is full or the list is exhausted.
 */
export async function collectGlobalOpponents({
  cities,
  targetCount,
  excludedPropertyIds,
  search,
  reserveBatchSize = 3,
}: CollectGlobalOpponentsArgs): Promise<CollectedGlobalOpponents> {
  const opponents: NormalizedAccommodation[] = [];
  const opponentCities: WorldCity[] = [];
  const usedPropertyIds = new Set(excludedPropertyIds);
  const attemptedCountries = new Set<string>();
  let cityIndex = 0;

  while (opponents.length < targetCount && cityIndex < cities.length) {
    const missing = targetCount - opponents.length;
    const desiredBatchSize =
      opponents.length === 0 ? targetCount : Math.max(missing, reserveBatchSize);
    const batch: WorldCity[] = [];

    while (cityIndex < cities.length && batch.length < desiredBatchSize) {
      const city = cities[cityIndex++];
      if (attemptedCountries.has(city.country)) continue;
      attemptedCountries.add(city.country);
      batch.push(city);
    }

    if (batch.length === 0) break;

    const results = await Promise.allSettled(batch.map((city) => search(city)));
    results.forEach((result, index) => {
      if (opponents.length >= targetCount || result.status === "rejected") return;

      const available = [...result.value.hotels]
        .filter((hotel) => !usedPropertyIds.has(hotel.id))
        .sort(
          (a, b) =>
            (b.guestRating ?? -1) - (a.guestRating ?? -1) ||
            (b.reviewCount ?? -1) - (a.reviewCount ?? -1) ||
            (a.id < b.id ? -1 : 1),
        );
      const selected = available[0];
      if (!selected) return;

      opponents.push(selected);
      opponentCities.push(batch[index]);
      usedPropertyIds.add(selected.id);
    });
  }

  return {
    opponents,
    opponentCities,
    attemptedCityCount: attemptedCountries.size,
  };
}
