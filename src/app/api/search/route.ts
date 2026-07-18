import { NextResponse, type NextRequest } from "next/server";
import { applyHardConstraints } from "@/lib/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/types";
import { searchAccommodations } from "@/lib/stay22/client";
import {
  asJson,
  handleApiError,
  normalizeCity,
  PACK_COST,
  requireUser,
  searchRequestSchema,
} from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Trip search: fetch live Stay22 results server-side, persist the API call
 * and normalized snapshots for history/replay, and report pool stats.
 * The Stay22 key never appears in any response.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = searchRequestSchema.parse(await request.json());

    const result = await searchAccommodations({
      address: body.destination,
      checkin: body.checkin,
      checkout: body.checkout,
      adults: body.adults,
      children: body.children,
      rooms: body.rooms,
      currency: "CAD",
      minNightly: body.minNightly ?? null,
      maxNightly: body.maxNightly ?? null,
    });

    const trip = {
      destinationLabel: result.destination.label,
      lat: result.destination.lat,
      lng: result.destination.lng,
      checkin: body.checkin,
      checkout: body.checkout,
      adults: body.adults,
      children: body.children,
      rooms: body.rooms,
      minNightly: body.minNightly ?? null,
      maxNightly: body.maxNightly ?? null,
      radiusKm: null,
      currency: "CAD",
    };
    const { eligible, excluded } = applyHardConstraints(result.hotels, trip, DEFAULT_ENGINE_CONFIG);

    const apiCall = await prisma.stay22ApiCall.create({
      data: {
        userId: user.id,
        endpoint: result.endpoint,
        requestParams: asJson({ ...result.requestParams, destination: result.destination }),
        responseBody: asJson(result.responseBody),
        status: result.status,
        snapshots: {
          create: result.hotels.map((hotel) => ({
            stay22PropertyId: hotel.id,
            normalizedData: asJson(hotel),
          })),
        },
      },
    });

    const city = normalizeCity(result.destination.label);
    const freePackAvailable =
      (await prisma.cityPackClaim.findUnique({
        where: { userId_normalizedCity: { userId: user.id, normalizedCity: city } },
      })) === null;

    return NextResponse.json({
      searchId: apiCall.id,
      mode: result.mode,
      destination: result.destination,
      totalResults: result.hotels.length,
      eligibleCount: eligible.length,
      excludedCount: excluded.length,
      freePackAvailable,
      packCost: freePackAvailable ? 0 : PACK_COST,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
