import type { CardPayload } from "@/components/types";
import type { Rarity } from "@/lib/game/cardStats";

export type SortKey = "recent" | "rating" | "price-asc" | "price-desc";
export type RarityFilter = Rarity | "all";

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "rating", label: "Guest rating" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export interface CardFilterState {
  countryFilter: string;
  rarityFilter: RarityFilter;
  sortBy: SortKey;
}

export interface CountryOption {
  code: string;
  name: string;
}

// Nullable numbers always sort to the end regardless of direction.
function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function getCountryOptions(cards: CardPayload[]): CountryOption[] {
  const byCode = new Map<string, string>();
  for (const card of cards) {
    const code = card.hotel.countryCode;
    if (!code) continue;
    byCode.set(code, card.hotel.countryName ?? code);
  }
  return [...byCode.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterAndSortCards(
  cards: CardPayload[],
  { countryFilter, rarityFilter, sortBy }: CardFilterState,
): CardPayload[] {
  const filtered = cards.filter(
    (card) =>
      (countryFilter === "all" || card.hotel.countryCode === countryFilter) &&
      (rarityFilter === "all" || card.rarity === rarityFilter),
  );

  if (sortBy === "recent") return filtered;

  const sorted = [...filtered];
  if (sortBy === "rating") {
    sorted.sort((a, b) =>
      compareNullableDesc(a.hotel.guestRating, b.hotel.guestRating),
    );
  } else if (sortBy === "price-asc") {
    sorted.sort((a, b) =>
      compareNullableAsc(a.hotel.nightlyPrice, b.hotel.nightlyPrice),
    );
  } else if (sortBy === "price-desc") {
    sorted.sort((a, b) =>
      compareNullableDesc(a.hotel.nightlyPrice, b.hotel.nightlyPrice),
    );
  }
  return sorted;
}
