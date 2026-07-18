import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "./auth";
import { prisma } from "./db";
import { syncUser } from "./userSync";
import type { NormalizedAccommodation, TripContext } from "@/lib/engine/types";
import type { Prisma, User } from "@/generated/prisma/client";

export const PACK_COST = 250;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const session = await getSessionUser();
  if (!session) throw new ApiError(401, "Sign in to play");
  return syncUser(session);
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", issues: error.issues },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export const searchRequestSchema = z
  .object({
    destination: z.string().trim().min(2).max(120),
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().min(1).max(16),
    children: z.number().int().min(0).max(12),
    rooms: z.number().int().min(1).max(8),
    minNightly: z.number().positive().max(100_000).nullish(),
    maxNightly: z.number().positive().max(100_000).nullish(),
  })
  .refine((v) => v.checkout > v.checkin, { message: "Checkout must be after check-in" })
  .refine((v) => !v.minNightly || !v.maxNightly || v.maxNightly >= v.minNightly, {
    message: "Max nightly price must be at least the minimum",
  });

export const answersSchema = z.array(
  z.object({
    questionId: z.string().max(64),
    optionIds: z.array(z.string().max(64)).max(4),
  }),
).max(10);

export interface SearchRecord {
  apiCallId: string;
  trip: TripContext;
  city: string;
  pool: NormalizedAccommodation[];
}

/** Rebuild a stored search (trip context + normalized pool) from history records. */
export async function loadSearch(apiCallId: string, userId: string): Promise<SearchRecord> {
  const apiCall = await prisma.stay22ApiCall.findFirst({
    where: { id: apiCallId, userId },
    include: { snapshots: true },
  });
  if (!apiCall) throw new ApiError(404, "Search not found");

  const params = apiCall.requestParams as Record<string, unknown>;
  const destination = params.destination as { lat: number; lng: number; label: string };
  const trip: TripContext = {
    destinationLabel: destination.label,
    lat: destination.lat,
    lng: destination.lng,
    checkin: String(params.checkin),
    checkout: String(params.checkout),
    adults: Number(params.adults),
    children: Number(params.children),
    rooms: Number(params.rooms),
    minNightly: params.min != null ? Number(params.min) : null,
    maxNightly: params.max != null ? Number(params.max) : null,
    radiusKm: null,
    currency: String(params.currency ?? "CAD"),
  };

  const pool = apiCall.snapshots.map(
    (s) => s.normalizedData as unknown as NormalizedAccommodation,
  );
  return { apiCallId: apiCall.id, trip, city: normalizeCity(destination.label), pool };
}

export function normalizeCity(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function asJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
