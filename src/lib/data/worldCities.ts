import type { Rng } from "@/lib/engine/seed";

/**
 * Curated worldwide city list for Global Packs and Global Cup Mode
 * (documentation/ideas/GAMEPLAY_PACK_IDEAS.md). One representative city per
 * country so picking "one city per country" gives every opponent a unique
 * country by construction — no `country` field needed on the hotel model.
 */
export interface WorldCity {
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export const WORLD_CITIES: WorldCity[] = [
  { city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832 },
  { city: "New York", country: "United States", lat: 40.7128, lng: -74.006 },
  { city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332 },
  { city: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "Germany", lat: 52.52, lng: 13.405 },
  { city: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038 },
  { city: "Lisbon", country: "Portugal", lat: 38.7223, lng: -9.1393 },
  { city: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964 },
  { city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041 },
  { city: "Brussels", country: "Belgium", lat: 50.8503, lng: 4.3517 },
  { city: "Zurich", country: "Switzerland", lat: 47.3769, lng: 8.5417 },
  { city: "Vienna", country: "Austria", lat: 48.2082, lng: 16.3738 },
  { city: "Dublin", country: "Ireland", lat: 53.3498, lng: -6.2603 },
  { city: "Copenhagen", country: "Denmark", lat: 55.6761, lng: 12.5683 },
  { city: "Stockholm", country: "Sweden", lat: 59.3293, lng: 18.0686 },
  { city: "Oslo", country: "Norway", lat: 59.9139, lng: 10.7522 },
  { city: "Helsinki", country: "Finland", lat: 60.1699, lng: 24.9384 },
  { city: "Warsaw", country: "Poland", lat: 52.2297, lng: 21.0122 },
  { city: "Prague", country: "Czechia", lat: 50.0755, lng: 14.4378 },
  { city: "Budapest", country: "Hungary", lat: 47.4979, lng: 19.0402 },
  { city: "Athens", country: "Greece", lat: 37.9838, lng: 23.7275 },
  { city: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784 },
  { city: "Moscow", country: "Russia", lat: 55.7558, lng: 37.6173 },
  { city: "Reykjavik", country: "Iceland", lat: 64.1466, lng: -21.9426 },
  { city: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357 },
  { city: "Marrakesh", country: "Morocco", lat: 31.6295, lng: -7.9811 },
  { city: "Nairobi", country: "Kenya", lat: -1.2921, lng: 36.8219 },
  { city: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792 },
  { city: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241 },
  { city: "Accra", country: "Ghana", lat: 5.6037, lng: -0.187 },
  { city: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708 },
  { city: "Doha", country: "Qatar", lat: 25.2854, lng: 51.531 },
  { city: "Tel Aviv", country: "Israel", lat: 32.0853, lng: 34.7818 },
  { city: "Amman", country: "Jordan", lat: 31.9454, lng: 35.9284 },
  { city: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lng: 46.6753 },
  { city: "Mumbai", country: "India", lat: 19.076, lng: 72.8777 },
  { city: "New Delhi", country: "India", lat: 28.6139, lng: 77.209 },
  { city: "Colombo", country: "Sri Lanka", lat: 6.9271, lng: 79.8612 },
  { city: "Kathmandu", country: "Nepal", lat: 27.7172, lng: 85.324 },
  { city: "Bangkok", country: "Thailand", lat: 13.7563, lng: 100.5018 },
  { city: "Hanoi", country: "Vietnam", lat: 21.0278, lng: 105.8342 },
  { city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { city: "Kuala Lumpur", country: "Malaysia", lat: 3.139, lng: 101.6869 },
  { city: "Jakarta", country: "Indonesia", lat: -6.2088, lng: 106.8456 },
  { city: "Manila", country: "Philippines", lat: 14.5995, lng: 120.9842 },
  { city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { city: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.978 },
  { city: "Beijing", country: "China", lat: 39.9042, lng: 116.4074 },
  { city: "Hong Kong", country: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { city: "Taipei", country: "Taiwan", lat: 25.033, lng: 121.5654 },
  { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
  { city: "Auckland", country: "New Zealand", lat: -36.8485, lng: 174.7633 },
  { city: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729 },
  { city: "Buenos Aires", country: "Argentina", lat: -34.6037, lng: -58.3816 },
  { city: "Santiago", country: "Chile", lat: -33.4489, lng: -70.6693 },
  { city: "Lima", country: "Peru", lat: -12.0464, lng: -77.0428 },
  { city: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721 },
  { city: "Havana", country: "Cuba", lat: 23.1136, lng: -82.3666 },
  { city: "San José", country: "Costa Rica", lat: 9.9281, lng: -84.0907 },
  { city: "Panama City", country: "Panama", lat: 8.9824, lng: -79.5199 },
];

/** Pick one random city from the world list, seeded. */
export function pickRandomCity(rng: Rng): WorldCity {
  const index = Math.floor(rng() * WORLD_CITIES.length);
  return WORLD_CITIES[Math.min(index, WORLD_CITIES.length - 1)];
}

/**
 * Pick up to `n` cities, each from a distinct country, seeded. Used for
 * Global Cup opponents so every match-up is guaranteed to be a different
 * country by construction.
 */
export function pickUniqueCountryCities(rng: Rng, n: number): WorldCity[] {
  const shuffled = [...WORLD_CITIES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const seenCountries = new Set<string>();
  const picked: WorldCity[] = [];
  for (const city of shuffled) {
    if (picked.length >= n) break;
    if (seenCountries.has(city.country)) continue;
    seenCountries.add(city.country);
    picked.push(city);
  }
  return picked;
}
