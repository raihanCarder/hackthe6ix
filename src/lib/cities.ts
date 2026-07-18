import "server-only";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

export interface CitySuggestion {
  id: number;
  name: string;
  admin1: string | null;
  country: string | null;
  label: string;
}

interface OpenMeteoResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
}

function toSuggestion(result: OpenMeteoResult): CitySuggestion {
  const admin1 = result.admin1 ?? null;
  const country = result.country ?? null;
  const label = [result.name, admin1, country].filter(Boolean).join(", ");
  return { id: result.id, name: result.name, admin1, country, label };
}

export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `${GEOCODING_URL}?name=${encodeURIComponent(trimmed)}&count=8&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) return [];

  const data = (await response.json()) as { results?: OpenMeteoResult[] };
  return (data.results ?? []).map(toSuggestion);
}

export async function isKnownCity(label: string): Promise<boolean> {
  const trimmed = label.trim();
  if (trimmed.length === 0) return true;

  const namePart = trimmed.split(",")[0].trim();
  const suggestions = await searchCities(namePart);
  const target = trimmed.toLowerCase();
  return suggestions.some(
    (s) => s.label.toLowerCase() === target || s.name.toLowerCase() === namePart.toLowerCase(),
  );
}
