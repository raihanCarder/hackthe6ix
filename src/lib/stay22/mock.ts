import { createRng, hashString } from "@/lib/engine/seed";
import { WORLD_CITIES } from "@/lib/data/worldCities";

/**
 * Deterministic mock accommodation provider. Active only when
 * STAY22_API_KEY is unset so the whole demo runs offline. The same
 * destination + dates always produce the same "live" result set.
 */

const CITY_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  toronto: { lat: 43.6532, lng: -79.3832, label: "Toronto" },
  montreal: { lat: 45.5019, lng: -73.5674, label: "Montréal" },
  vancouver: { lat: 49.2827, lng: -123.1207, label: "Vancouver" },
  calgary: { lat: 51.0447, lng: -114.0719, label: "Calgary" },
  ottawa: { lat: 45.4215, lng: -75.6972, label: "Ottawa" },
  "new york": { lat: 40.7128, lng: -74.006, label: "New York" },
  london: { lat: 51.5074, lng: -0.1278, label: "London" },
  paris: { lat: 48.8566, lng: 2.3522, label: "Paris" },
  tokyo: { lat: 35.6762, lng: 139.6503, label: "Tokyo" },
  barcelona: { lat: 41.3874, lng: 2.1686, label: "Barcelona" },
  ...Object.fromEntries(
    WORLD_CITIES.map((c) => [c.city.toLowerCase(), { lat: c.lat, lng: c.lng, label: c.city }]),
  ),
};

export function resolveDestination(address: string): { lat: number; lng: number; label: string } {
  const key = address.trim().toLowerCase();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(name)) return coords;
  }
  // Unknown destination: deterministic pseudo-coordinates so the demo still works.
  const rng = createRng(`geo:${key}`);
  return {
    lat: -60 + rng() * 120,
    lng: -180 + rng() * 360,
    label: address.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

const NAME_FIRST = [
  "Harbour", "Maple", "Grand", "Royal", "Lakeside", "Metro", "Union", "King's",
  "Queen West", "Distillery", "Garden", "Old Town", "Riverside", "Summit",
  "Beacon", "Crescent", "Northern", "Velvet", "Copper", "Atlas",
];
const NAME_SECOND: Record<string, string[]> = {
  hotel: ["Hotel", "Grand Hotel", "House", "Inn", "Lodge", "Suites", "Palace"],
  apartment: ["Apartments", "Lofts", "Residences", "Flats"],
  hostel: ["Hostel", "Backpackers", "Bunkhouse"],
  bnb: ["B&B", "Guesthouse", "Cottage"],
};
const TYPES = ["hotel", "hotel", "hotel", "hotel", "apartment", "apartment", "hostel", "bnb"];

export interface MockSearchParams {
  address: string;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  rooms: number;
}

export function generateMockResults(params: MockSearchParams): Record<string, unknown>[] {
  const destination = resolveDestination(params.address);
  const seed = hashString(
    `mock:${destination.label}:${params.checkin}:${params.checkout}:${params.adults}:${params.children}:${params.rooms}`,
  );
  const rng = createRng(seed);
  const count = 26 + Math.floor(rng() * 10);
  const results: Record<string, unknown>[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const type = TYPES[Math.floor(rng() * TYPES.length)];
    let name = "";
    do {
      const second = NAME_SECOND[type];
      name = `${NAME_FIRST[Math.floor(rng() * NAME_FIRST.length)]} ${second[Math.floor(rng() * second.length)]}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const id = `mock_${hashString(`${seed}:${name}`).slice(0, 12)}`;
    const capacityBase = type === "hostel" ? 1 : type === "apartment" ? 4 : 2;
    const capacity = capacityBase + Math.floor(rng() * 4);
    const bedrooms = Math.max(1, Math.floor(capacity / 2));
    const rating = Math.round((5.8 + rng() * 4.1) * 10) / 10;
    const reviewCount = Math.floor(Math.pow(rng(), 1.6) * 4200);
    const priceBase = type === "hostel" ? 60 : type === "bnb" ? 120 : type === "apartment" ? 170 : 150;
    const nightlyPrice = Math.round(priceBase * (0.7 + rng() * 2.2));
    const supplierCount = 1 + Math.floor(rng() * 5);

    const record: Record<string, unknown> = {
      id,
      name,
      type,
      address: `${10 + Math.floor(rng() * 990)} ${NAME_FIRST[Math.floor(rng() * NAME_FIRST.length)]} St, ${destination.label}`,
      lat: destination.lat + (rng() - 0.5) * 0.09,
      lng: destination.lng + (rng() - 0.5) * 0.12,
      guestRating: rng() < 0.92 ? Math.min(9.9, rating) : undefined,
      reviewCount: rng() < 0.88 ? reviewCount : undefined,
      stars: type === "hotel" ? 2 + Math.floor(rng() * 4) : undefined,
      capacity,
      bedrooms,
      beds: bedrooms + (rng() < 0.4 ? 1 : 0),
      bathrooms: Math.max(1, bedrooms - 1),
      freeCancellation: rng() < 0.85 ? rng() < 0.55 : undefined,
      instantBooking: rng() < 0.8 ? rng() < 0.45 : undefined,
      supplierCount,
      supplierIds: Array.from({ length: supplierCount }, (_, s) => `sup_${s}_${id}`),
      nightlyPrice,
      bookingUrl: `https://www.stay22.com/allez/book?property=${id}&checkin=${params.checkin}&checkout=${params.checkout}&demo=1`,
    };
    // Simulate patchy records like a real aggregator feed.
    if (rng() < 0.12) delete record.capacity;
    if (rng() < 0.15) delete record.beds;
    results.push(record);
  }
  return results;
}
