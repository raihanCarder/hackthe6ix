import "server-only";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import {
  applyHardConstraints,
  calculatePoolMetrics,
  normalizeTravelerAnswers,
  selectAdaptiveQuestions,
  selectNextQuestionCandidates,
} from "@/lib/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/types";
import type { NormalizedAccommodation, TripContext } from "@/lib/engine/types";
import { generateAdaptiveQuestion } from "@/lib/gemini/questions";
import { searchAccommodations } from "@/lib/stay22/client";
import { prisma } from "@/lib/db";
import { pickRandomCity } from "@/lib/data/worldCities";
import { createRng, hashString } from "@/lib/engine/seed";
import { asJson, ApiError, PACK_COST } from "./core";

export const searchRequestSchema = z
  .object({
    scope: z.enum(["trip", "global"]).default("trip"),
    destination: z.string().trim().min(2).max(120).optional(),
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
  })
  .refine((v) => v.scope === "global" || (v.destination?.length ?? 0) >= 2, {
    message: "Destination is required for a Trip Pack",
    path: ["destination"],
  });

export const answersSchema = z.array(
  z.object({
    questionId: z.string().max(64),
    optionIds: z.array(z.string().max(64)).max(4),
  }),
).max(10);

export const nextQuestionRequestSchema = z.object({
  answers: answersSchema.default([]),
});

const MAX_QUESTIONS = 5;

export interface SearchRecord {
  apiCallId: string;
  trip: TripContext;
  city: string;
  pool: NormalizedAccommodation[];
}

export async function createSearch(user: User, body: z.infer<typeof searchRequestSchema>) {
  const address =
    body.scope === "global"
      ? pickRandomCity(createRng(hashString(`global-pack:${user.id}:${user.packsOpened}`))).city
      : body.destination!;

  const result = await searchAccommodations({
    address,
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
    body.scope === "trip" &&
    (await prisma.cityPackClaim.findUnique({
      where: { userId_normalizedCity: { userId: user.id, normalizedCity: city } },
    })) === null;

  return {
    searchId: apiCall.id,
    scope: body.scope,
    mode: result.mode,
    destination: result.destination,
    totalResults: result.hotels.length,
    eligibleCount: eligible.length,
    excludedCount: excluded.length,
    freePackAvailable,
    packCost: freePackAvailable ? 0 : PACK_COST,
  };
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

export async function getSearchQuestions(searchId: string, userId: string) {
  const search = await loadSearch(searchId, userId);
  const { eligible } = applyHardConstraints(search.pool, search.trip, DEFAULT_ENGINE_CONFIG);
  const { availability, activeMetrics } = calculatePoolMetrics(
    eligible,
    search.trip,
    DEFAULT_ENGINE_CONFIG,
  );
  const questions = selectAdaptiveQuestions({
    activeMetrics,
    availability,
    partySize: search.trip.adults + search.trip.children,
  });

  return {
    questions,
    activeMetrics,
    availability: availability.map((a) => ({
      metric: a.metric,
      status: a.status,
      coverage: Math.round(a.coverage * 100) / 100,
      reason: a.reason,
    })),
  };
}

/** Generate one validated question at a time, conditioned on prior answers. */
export async function getNextSearchQuestion(
  searchId: string,
  userId: string,
  submittedAnswers: z.infer<typeof answersSchema>,
) {
  const search = await loadSearch(searchId, userId);
  const { eligible } = applyHardConstraints(search.pool, search.trip, DEFAULT_ENGINE_CONFIG);
  const { availability, activeMetrics } = calculatePoolMetrics(
    eligible,
    search.trip,
    DEFAULT_ENGINE_CONFIG,
  );
  const answers = normalizeTravelerAnswers(submittedAnswers);
  const context = {
    activeMetrics,
    availability,
    partySize: search.trip.adults + search.trip.children,
  };
  const candidates = selectNextQuestionCandidates(context, answers);

  if (answers.length >= MAX_QUESTIONS || candidates.length === 0) {
    return {
      complete: true as const,
      question: null,
      questionNumber: answers.length,
      maxQuestions: MAX_QUESTIONS,
      source: "complete" as const,
    };
  }

  const generated = await generateAdaptiveQuestion({
    trip: search.trip,
    availability,
    answers,
    candidates,
  });
  return {
    complete: false as const,
    question: generated ?? candidates[0],
    questionNumber: answers.length + 1,
    maxQuestions: MAX_QUESTIONS,
    source: generated ? ("gemini" as const) : ("deterministic" as const),
  };
}

export function normalizeCity(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
