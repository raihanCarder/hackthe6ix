import type {
  EligibilityResult,
  EngineConfig,
  ExclusionReason,
  NormalizedAccommodation,
  TripContext,
} from "./types";
import { haversineKm } from "./metrics";

/**
 * Hard filters (documentation/ideas/ALGORITHM_DESIGN.md §1.3). Runs after dedupe, before scoring.
 * Missing data is not automatic failure — each rule has an explicit policy.
 */
export function applyHardConstraints(
  hotels: NormalizedAccommodation[],
  trip: TripContext,
  config: EngineConfig,
): EligibilityResult {
  const eligible: NormalizedAccommodation[] = [];
  const excluded: EligibilityResult["excluded"] = [];
  const party = trip.adults + trip.children;

  for (const hotel of hotels) {
    const reasons: ExclusionReason[] = [];

    if (!hotel.id) {
      reasons.push("MISSING_PROPERTY_ID");
    }

    // Capacity: fail when a known capacity is too small; fail closed for
    // larger parties when capacity is unknown (can't safely establish fit).
    if (hotel.capacity !== null && hotel.capacity < party) {
      reasons.push("INSUFFICIENT_CAPACITY");
    } else if (hotel.capacity === null && party >= config.failClosedPartySize) {
      reasons.push("UNKNOWN_CAPACITY_FAIL_CLOSED");
    }

    // Explicit multi-room requirement against known bedrooms.
    if (trip.rooms > 1 && hotel.bedrooms !== null && hotel.bedrooms < trip.rooms) {
      reasons.push("INSUFFICIENT_ROOMS");
    }

    // Explicit radius is a hard geographic boundary.
    if (trip.radiusKm !== null && trip.lat !== null && trip.lng !== null) {
      if (hotel.latitude === null || hotel.longitude === null) {
        reasons.push("MISSING_REQUIRED_COORDINATES");
      } else {
        const km = haversineKm(trip.lat, trip.lng, hotel.latitude, hotel.longitude);
        if (km > trip.radiusKm) reasons.push("OUTSIDE_BOUNDARY");
      }
    }

    // Price limits apply only when an actual comparable price exists.
    if (hotel.nightlyPrice !== null) {
      if (
        (trip.minNightly !== null && hotel.nightlyPrice < trip.minNightly) ||
        (trip.maxNightly !== null && hotel.nightlyPrice > trip.maxNightly)
      ) {
        reasons.push("OUTSIDE_PRICE_LIMITS");
      }
    }

    if (reasons.length > 0) {
      excluded.push({ id: hotel.id || "(missing-id)", name: hotel.name, reasons });
    } else {
      eligible.push(hotel);
    }
  }

  return { eligible, excluded };
}
