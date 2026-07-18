import type { NormalizedAccommodation } from "@/lib/engine/types";

/**
 * Runtime validation and canonicalization of one raw Stay22 accommodation
 * record (documentation/ideas/ALGORITHM_DESIGN.md §1.2). Missing stays missing — `unknown` is
 * preserved as null, never coerced to false or zero.
 *
 * NOTE: field names must be re-verified against the live Stay22 integration
 * schema before production use; the mock provider emits this exact shape.
 */
export function normalizeStay22Property(raw: unknown): NormalizedAccommodation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const id = asId(r.id ?? r.propertyId ?? r.hotelId);
  if (!id) return null;

  const provenance: Record<string, string[]> = {};
  const mark = (field: string) => {
    provenance[field] = ["stay22:accommodation-search"];
  };

  const result: NormalizedAccommodation = {
    id,
    bookingUrl: asHttpUrl(r.bookingUrl ?? r.url ?? r.deeplink),
    supplierIds: asStringArray(r.supplierIds ?? r.suppliers),
    supplierLinks: asStringArray(r.supplierLinks).filter((u) => asHttpUrl(u) !== null),
    supplierCount: asCount(r.supplierCount),
    name: asString(r.name),
    propertyType: asString(r.type ?? r.propertyType)?.toLowerCase() ?? null,
    address: asString(r.address),
    latitude: asCoordinate(r.lat ?? r.latitude, 90),
    longitude: asCoordinate(r.lng ?? r.longitude, 180),
    distanceKm: null, // origin/units of API-provided distance unverified — recompute instead
    guestRating: asBoundedNumber(r.guestRating ?? r.rating, 0, 10),
    stars: asBoundedNumber(r.stars ?? r.starRating, 0, 5),
    reviewCount: asCount(r.reviewCount ?? r.ratingCount),
    capacity: asCount(r.capacity ?? r.guests),
    bedrooms: asCount(r.bedrooms),
    beds: asCount(r.beds),
    bathrooms: asCount(r.bathrooms),
    freeCancellation: asBoolean(r.freeCancellation),
    instantBooking: asBoolean(r.instantBooking ?? r.instantBook),
    thumbnailUrl: asHttpUrl(r.thumbnail ?? r.thumbnailUrl),
    nightlyPrice: asBoundedNumber(r.nightlyPrice, 0, 1_000_000),
    provenance,
  };

  for (const [key, value] of Object.entries(result)) {
    if (key === "provenance") continue;
    if (value !== null && !(Array.isArray(value) && value.length === 0)) mark(key);
  }
  return result;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function asId(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return asString(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asId).filter((x): x is string => x !== null);
}

function asBoundedNumber(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function asCount(v: unknown): number | null {
  const n = asBoundedNumber(v, 0, 1_000_000);
  return n === null ? null : Math.floor(n);
}

function asCoordinate(v: unknown, bound: number): number | null {
  return asBoundedNumber(v, -bound, bound);
}

function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function asHttpUrl(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
