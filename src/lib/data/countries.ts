import { WORLD_CITIES } from "@/lib/data/worldCities";

export interface CountryInfo {
  code: string;
  name: string;
}

const COUNTRY_ENTRIES: Array<[string, CountryInfo]> = [
  ["canada", { code: "CA", name: "Canada" }],
  ["united states", { code: "US", name: "United States" }],
  ["united states of america", { code: "US", name: "United States" }],
  ["usa", { code: "US", name: "United States" }],
  ["us", { code: "US", name: "United States" }],
  ["mexico", { code: "MX", name: "Mexico" }],
  ["united kingdom", { code: "GB", name: "United Kingdom" }],
  ["uk", { code: "GB", name: "United Kingdom" }],
  ["u.k", { code: "GB", name: "United Kingdom" }],
  ["great britain", { code: "GB", name: "United Kingdom" }],
  ["england", { code: "GB", name: "United Kingdom" }],
  ["france", { code: "FR", name: "France" }],
  ["germany", { code: "DE", name: "Germany" }],
  ["spain", { code: "ES", name: "Spain" }],
  ["portugal", { code: "PT", name: "Portugal" }],
  ["italy", { code: "IT", name: "Italy" }],
  ["netherlands", { code: "NL", name: "Netherlands" }],
  ["belgium", { code: "BE", name: "Belgium" }],
  ["switzerland", { code: "CH", name: "Switzerland" }],
  ["austria", { code: "AT", name: "Austria" }],
  ["ireland", { code: "IE", name: "Ireland" }],
  ["denmark", { code: "DK", name: "Denmark" }],
  ["sweden", { code: "SE", name: "Sweden" }],
  ["norway", { code: "NO", name: "Norway" }],
  ["finland", { code: "FI", name: "Finland" }],
  ["poland", { code: "PL", name: "Poland" }],
  ["czechia", { code: "CZ", name: "Czechia" }],
  ["czech republic", { code: "CZ", name: "Czechia" }],
  ["hungary", { code: "HU", name: "Hungary" }],
  ["greece", { code: "GR", name: "Greece" }],
  ["turkey", { code: "TR", name: "Turkey" }],
  ["russia", { code: "RU", name: "Russia" }],
  ["iceland", { code: "IS", name: "Iceland" }],
  ["egypt", { code: "EG", name: "Egypt" }],
  ["morocco", { code: "MA", name: "Morocco" }],
  ["kenya", { code: "KE", name: "Kenya" }],
  ["nigeria", { code: "NG", name: "Nigeria" }],
  ["south africa", { code: "ZA", name: "South Africa" }],
  ["ghana", { code: "GH", name: "Ghana" }],
  ["united arab emirates", { code: "AE", name: "United Arab Emirates" }],
  ["uae", { code: "AE", name: "United Arab Emirates" }],
  ["qatar", { code: "QA", name: "Qatar" }],
  ["israel", { code: "IL", name: "Israel" }],
  ["jordan", { code: "JO", name: "Jordan" }],
  ["saudi arabia", { code: "SA", name: "Saudi Arabia" }],
  ["india", { code: "IN", name: "India" }],
  ["sri lanka", { code: "LK", name: "Sri Lanka" }],
  ["nepal", { code: "NP", name: "Nepal" }],
  ["thailand", { code: "TH", name: "Thailand" }],
  ["vietnam", { code: "VN", name: "Vietnam" }],
  ["singapore", { code: "SG", name: "Singapore" }],
  ["malaysia", { code: "MY", name: "Malaysia" }],
  ["indonesia", { code: "ID", name: "Indonesia" }],
  ["philippines", { code: "PH", name: "Philippines" }],
  ["japan", { code: "JP", name: "Japan" }],
  ["south korea", { code: "KR", name: "South Korea" }],
  ["korea", { code: "KR", name: "South Korea" }],
  ["china", { code: "CN", name: "China" }],
  ["hong kong", { code: "HK", name: "Hong Kong" }],
  ["taiwan", { code: "TW", name: "Taiwan" }],
  ["australia", { code: "AU", name: "Australia" }],
  ["new zealand", { code: "NZ", name: "New Zealand" }],
  ["brazil", { code: "BR", name: "Brazil" }],
  ["argentina", { code: "AR", name: "Argentina" }],
  ["chile", { code: "CL", name: "Chile" }],
  ["peru", { code: "PE", name: "Peru" }],
  ["colombia", { code: "CO", name: "Colombia" }],
  ["cuba", { code: "CU", name: "Cuba" }],
  ["costa rica", { code: "CR", name: "Costa Rica" }],
  ["panama", { code: "PA", name: "Panama" }],
];

const CITY_COUNTRY_OVERRIDES: Array<[string, CountryInfo]> = [
  ["montreal", { code: "CA", name: "Canada" }],
  ["montréal", { code: "CA", name: "Canada" }],
  ["vancouver", { code: "CA", name: "Canada" }],
  ["calgary", { code: "CA", name: "Canada" }],
  ["ottawa", { code: "CA", name: "Canada" }],
  ["barcelona", { code: "ES", name: "Spain" }],
];

const COUNTRY_BY_NAME = new Map(
  COUNTRY_ENTRIES.map(([name, info]) => [normalizeToken(name), info]),
);

const COUNTRY_BY_CODE = new Map<string, CountryInfo>();
for (const [, info] of COUNTRY_ENTRIES) {
  COUNTRY_BY_CODE.set(info.code, info);
}

const CITY_BY_NAME = new Map<string, CountryInfo>();
for (const city of WORLD_CITIES) {
  const country = countryFromName(city.country);
  if (country) CITY_BY_NAME.set(normalizeToken(city.city), country);
}
for (const [city, country] of CITY_COUNTRY_OVERRIDES) {
  CITY_BY_NAME.set(normalizeToken(city), country);
}

export function countryFromCode(code: string | null | undefined): CountryInfo | null {
  if (!code) return null;
  return COUNTRY_BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

export function countryFromName(name: string | null | undefined): CountryInfo | null {
  if (!name) return null;
  return COUNTRY_BY_NAME.get(normalizeToken(name)) ?? null;
}

export function inferCountryFromText(
  text: string | null | undefined,
  fallbackText?: string | null,
): CountryInfo | null {
  const candidates = [text, fallbackText].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const parts = candidate
      .split(",")
      .map((part) => normalizeToken(part))
      .filter(Boolean);
    for (const part of parts.slice().reverse()) {
      const country = COUNTRY_BY_NAME.get(part) ?? CITY_BY_NAME.get(part);
      if (country) return country;
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate);
    for (const [countryName, country] of COUNTRY_BY_NAME) {
      if (containsTokenizedPhrase(normalized, countryName)) return country;
    }
    for (const [cityName, country] of CITY_BY_NAME) {
      if (containsTokenizedPhrase(normalized, cityName)) return country;
    }
  }

  return null;
}

export function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsTokenizedPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}
