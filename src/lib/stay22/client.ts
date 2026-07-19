import "server-only";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { inferCountryFromText, type CountryInfo } from "@/lib/data/countries";
import { dedupeAccommodations } from "./dedupe";
import { generateMockResults, resolveDestination } from "./mock";
import { normalizeStay22Property } from "./normalize";

/**
 * Server-only Stay22 access. The API key never leaves this module and is
 * never included in responses, seeds, or logs. Without a key the client
 * runs in deterministic mock mode so the demo works offline.
 */

export interface Stay22SearchParams {
  address: string;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  rooms: number;
  currency: string;
  maxNightly?: number | null;
  minNightly?: number | null;
}

export interface Stay22SearchResult {
  endpoint: string;
  requestParams: Record<string, unknown>;
  /** Raw response body — persisted for history/audit (never contains credentials). */
  responseBody: unknown;
  status: number;
  destination: { lat: number; lng: number; label: string; country: CountryInfo | null };
  hotels: NormalizedAccommodation[];
  mode: "live" | "mock";
}

export function isLiveMode(): boolean {
  return Boolean(process.env.STAY22_API_KEY);
}

export async function searchAccommodations(params: Stay22SearchParams): Promise<Stay22SearchResult> {
  const destination = resolveDestination(params.address);
  const country = inferCountryFromText(params.address, destination.label);
  const requestParams: Record<string, unknown> = {
    address: params.address,
    checkin: params.checkin,
    checkout: params.checkout,
    adults: params.adults,
    children: params.children,
    rooms: params.rooms,
    currency: params.currency,
    ...(params.minNightly != null ? { min: params.minNightly } : {}),
    ...(params.maxNightly != null ? { max: params.maxNightly } : {}),
  };

  let rawList: unknown[];
  let responseBody: unknown;
  let status: number;
  let endpoint: string;
  let mode: "live" | "mock";

  if (isLiveMode()) {
    const base = process.env.STAY22_API_BASE ?? "https://api.stay22.com";
    endpoint = `${base.replace(/\/$/, "")}/v2/accommodations`;
    const url = new URL(endpoint);
    for (const [k, v] of Object.entries(requestParams)) url.searchParams.set(k, String(v));
    url.searchParams.set("pageSize", "50");
    if (process.env.STAY22_AFFILIATE_ID) url.searchParams.set("aid", process.env.STAY22_AFFILIATE_ID);
    if (process.env.STAY22_CAMPAIGN) url.searchParams.set("campaign", process.env.STAY22_CAMPAIGN);

    const response = await fetch(url, {
      headers: { "X-API-KEY": process.env.STAY22_API_KEY! },
      cache: "no-store",
    });
    status = response.status;
    responseBody = await response.json().catch(() => ({}));
    if (!response.ok) throw Stay22Error.fromResponse(status, responseBody);
    const body = responseBody as {
      results?: unknown[];
      data?: unknown[];
      meta?: { nights?: unknown };
    };
    rawList = body.results ?? body.data ?? [];
    mode = "live";
  } else {
    endpoint = "mock://stay22/accommodations/search";
    rawList = generateMockResults(params);
    responseBody = { results: rawList, mock: true };
    status = 200;
    mode = "mock";
  }

  const responseMeta = asRecord(responseBody)?.meta;
  const nights = asPositiveNumber(asRecord(responseMeta)?.nights);
  const normalized = rawList
    .map((raw) => normalizeStay22Property(raw, { nights, country }))
    .filter((h): h is NormalizedAccommodation => h !== null);
  const hotels = dedupeAccommodations(normalized);

  return {
    endpoint,
    requestParams,
    responseBody,
    status,
    destination: { ...destination, country },
    hotels,
    mode,
  };
}

/** Live rehydration for booking CTAs (fresh price/policies/links). */
export async function rehydrateProperty(
  propertyId: string,
  params: Stay22SearchParams,
): Promise<NormalizedAccommodation | null> {
  const result = await searchAccommodations(params);
  return result.hotels.find((h) => h.id === propertyId) ?? null;
}

export class Stay22Error extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "Stay22Error";
  }

  static fromResponse(status: number, body: unknown): Stay22Error {
    const record = asRecord(body);
    const code = typeof record?.code === "string" ? record.code : undefined;
    const detail = typeof record?.message === "string" ? record.message : undefined;
    const suffix = [code, detail].filter(Boolean).join(": ");
    return new Stay22Error(
      `Stay22 search failed with status ${status}${suffix ? ` (${suffix})` : ""}`,
      status,
      code,
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asPositiveNumber(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0
    ? number
    : null;
}
