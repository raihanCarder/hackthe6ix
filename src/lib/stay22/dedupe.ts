import { haversineKm } from "@/lib/engine/metrics";
import type { NormalizedAccommodation } from "@/lib/engine/types";

/**
 * Conservative duplicate merging (ALGORITHM_DESIGN.md §1.2): exact ID match,
 * or high name similarity plus ≤80 m proximity. Ambiguous pairs stay
 * separate. Merges keep the most complete facts; conflicts stay untouched
 * on the primary record rather than being averaged.
 */
export function dedupeAccommodations(hotels: NormalizedAccommodation[]): NormalizedAccommodation[] {
  const byId = new Map<string, NormalizedAccommodation>();
  for (const hotel of hotels) {
    const existing = byId.get(hotel.id);
    byId.set(hotel.id, existing ? mergeRecords(existing, hotel) : hotel);
  }

  const result: NormalizedAccommodation[] = [];
  for (const hotel of byId.values()) {
    const duplicateOf = result.find((other) => isLikelyDuplicate(other, hotel));
    if (duplicateOf) {
      result[result.indexOf(duplicateOf)] = mergeRecords(duplicateOf, hotel);
    } else {
      result.push(hotel);
    }
  }
  return result;
}

function isLikelyDuplicate(a: NormalizedAccommodation, b: NormalizedAccommodation): boolean {
  if (!a.name || !b.name) return false;
  if (normalizeName(a.name) !== normalizeName(b.name)) return false;
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) {
    // Same normalized name + same normalized address is sufficient evidence.
    return Boolean(a.address && b.address && normalizeName(a.address) === normalizeName(b.address));
  }
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) <= 0.08;
}

function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b(inc|ltd|llc|hotel|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function mergeRecords(
  primary: NormalizedAccommodation,
  secondary: NormalizedAccommodation,
): NormalizedAccommodation {
  const merged: NormalizedAccommodation = { ...primary };
  for (const key of Object.keys(secondary) as Array<keyof NormalizedAccommodation>) {
    if (key === "provenance" || key === "supplierIds" || key === "supplierLinks") continue;
    if (merged[key] === null && secondary[key] !== null) {
      (merged as unknown as Record<string, unknown>)[key] = secondary[key];
    }
  }
  merged.supplierIds = [...new Set([...primary.supplierIds, ...secondary.supplierIds])];
  merged.supplierLinks = [...new Set([...primary.supplierLinks, ...secondary.supplierLinks])];
  if (merged.supplierCount !== null || secondary.supplierCount !== null) {
    merged.supplierCount = Math.max(
      merged.supplierCount ?? 0,
      secondary.supplierCount ?? 0,
      merged.supplierIds.length,
    );
  }
  merged.provenance = { ...secondary.provenance, ...primary.provenance };
  return merged;
}
