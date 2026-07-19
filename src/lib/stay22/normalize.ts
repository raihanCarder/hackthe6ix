import type { NormalizedAccommodation } from "@/lib/engine/types";
import {
  countryFromCode,
  countryFromName,
  type CountryInfo,
} from "@/lib/data/countries";

/**
 * Runtime validation and canonicalization of one raw Stay22 accommodation
 * record (documentation/ideas/ALGORITHM_DESIGN.md §1.2). Missing stays missing — `unknown` is
 * preserved as null, never coerced to false or zero.
 *
 * Supports the current nested Stay22 v2 response and the flat deterministic
 * mock shape. A supplier quote is a full-stay total, so it becomes a nightly
 * price only when response metadata supplies a valid night count.
 */
export function normalizeStay22Property(
  raw: unknown,
  context: { nights?: number | null; country?: CountryInfo | null } = {},
): NormalizedAccommodation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const location = asRecord(r.location);
  const coordinates = asRecord(location?.coordinates);
  const rating = asRecord(r.rating);
  const capacity = asRecord(r.capacity);
  const policies = asRecord(r.policies);
  const media = asRecord(r.media);
  const country = parseCountry(r, location) ?? context.country ?? null;
  const suppliers = parseSuppliers(r.suppliers);
  const quotedTotals = suppliers
    .map((supplier) => supplier.totalPrice)
    .filter((price): price is number => price !== null);
  const cheapestTotal = quotedTotals.length > 0 ? Math.min(...quotedTotals) : null;
  const liveNightlyPrice =
    cheapestTotal !== null && context.nights != null && context.nights > 0
      ? Math.round((cheapestTotal / context.nights) * 100) / 100
      : null;

  const id = asId(r.id ?? r.propertyId ?? r.hotelId);
  if (!id) return null;

  const provenance: Record<string, string[]> = {};
  const mark = (field: string) => {
    provenance[field] = ["stay22:accommodation-search"];
  };

  const result: NormalizedAccommodation = {
    id,
    bookingUrl: asHttpUrl(r.bookingUrl ?? r.url ?? r.deeplink),
    supplierIds:
      suppliers.length > 0
        ? suppliers.map(({ name, id: supplierId }) => `${name}:${supplierId}`)
        : asStringArray(r.supplierIds),
    supplierLinks:
      suppliers.length > 0
        ? suppliers.map((supplier) => supplier.link)
        : asHttpUrlArray(r.supplierLinks),
    supplierCount: suppliers.length > 0 ? suppliers.length : asCount(r.supplierCount),
    name: asString(r.name),
    propertyType: asString(r.type ?? r.propertyType)?.toLowerCase() ?? null,
    address: asString(location?.address ?? r.address),
    countryCode: country?.code ?? null,
    countryName: country?.name ?? null,
    latitude: asCoordinate(coordinates?.lat ?? r.lat ?? r.latitude, 90),
    longitude: asCoordinate(coordinates?.lng ?? r.lng ?? r.longitude, 180),
    distanceKm: distanceKm(location?.distanceInMeters),
    guestRating: asBoundedNumber(rating?.value ?? r.guestRating ?? r.rating, 0, 10),
    stars: asBoundedNumber(rating?.hotelStars ?? r.stars ?? r.starRating, 0, 5),
    reviewCount: asCount(rating?.count ?? r.reviewCount ?? r.ratingCount),
    capacity: asCount(capacity?.guests ?? r.capacity ?? r.guests),
    bedrooms: asCount(capacity?.bedrooms ?? r.bedrooms),
    beds: asCount(capacity?.beds ?? r.beds),
    bathrooms: asBoundedNumber(capacity?.bathrooms ?? r.bathrooms, 0, 1_000),
    freeCancellation: asBoolean(policies?.freeCancellation ?? r.freeCancellation),
    instantBooking: asBoolean(
      policies?.instantBook ?? r.instantBooking ?? r.instantBook,
    ),
    thumbnailUrl: asHttpUrl(media?.thumbnail ?? r.thumbnail ?? r.thumbnailUrl),
    nightlyPrice:
      liveNightlyPrice ?? asBoundedNumber(r.nightlyPrice, 0, 1_000_000),
    provenance,
  };

  for (const [key, value] of Object.entries(result)) {
    if (key === "provenance") continue;
    if (value !== null && !(Array.isArray(value) && value.length === 0)) mark(key);
  }
  return result;
}

function parseCountry(
  raw: Record<string, unknown>,
  location: Record<string, unknown> | null,
): CountryInfo | null {
  const code = asString(location?.countryCode ?? raw.countryCode ?? raw.country_code);
  const byCode = countryFromCode(code);
  if (byCode) return byCode;

  const name = asString(location?.country ?? raw.country ?? raw.countryName);
  return countryFromName(name);
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

function asHttpUrlArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asHttpUrl).filter((url): url is string => url !== null);
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

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function distanceKm(v: unknown): number | null {
  const meters = asBoundedNumber(v, 0, 100_000_000);
  return meters === null ? null : meters / 1_000;
}

interface ParsedSupplier {
  name: string;
  id: string;
  link: string;
  totalPrice: number | null;
}

function parseSuppliers(v: unknown): ParsedSupplier[] {
  const supplierMap = asRecord(v);
  if (!supplierMap) return [];

  const suppliers: ParsedSupplier[] = [];
  for (const [name, value] of Object.entries(supplierMap)) {
    const supplier = asRecord(value);
    if (!supplier) continue;
    const id = asId(supplier.id);
    const link = asHttpUrl(supplier.link);
    if (!id || !link) continue;
    const price = asRecord(supplier.price);
    suppliers.push({
      name,
      id,
      link,
      totalPrice: asBoundedNumber(price?.total, 0, 100_000_000),
    });
  }
  return suppliers;
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
