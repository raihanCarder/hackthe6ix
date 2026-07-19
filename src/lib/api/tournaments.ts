import "server-only";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import type { EngineResult, NormalizedAccommodation } from "@/lib/engine/types";
import { normalizeTravelerAnswers } from "@/lib/engine";
import {
  collectibleOverallRating,
  computeCardStats,
  poolPriceContext,
  resolveTournamentRarity,
} from "@/lib/game/cardStats";
import type { TournamentBracket } from "@/lib/game/matchSim";
import { createGlobalTournament, createTripTournament } from "@/lib/tournament";
import { prisma } from "@/lib/db";
import { ApiError } from "./core";
import { answersSchema, loadSearch } from "./searches";

export const createTournamentSchema = z.object({
  mode: z.enum(["trip", "world"]),
  cardId: z.string().min(1),
  answers: answersSchema.default([]),
});

/** Trip Cup Mode or Global Cup Mode — one selected card enters the bracket. */
export async function createTournamentForCard(
  user: User,
  body: z.infer<typeof createTournamentSchema>,
) {
  const { tournament } =
    body.mode === "trip"
      ? await createTripTournament({
          user,
          cardId: body.cardId,
          answers: normalizeTravelerAnswers(body.answers),
        })
      : await createGlobalTournament({ user, cardId: body.cardId });

  return { tournamentId: tournament.id };
}

/** Compact history list — one summary per tournament, newest first. */
export async function listTournaments(user: User) {
  const tournaments = await prisma.tournament.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      searchApiCall: {
        select: {
          snapshots: {
            select: { stay22PropertyId: true, normalizedData: true },
          },
        },
      },
    },
  });

  return tournaments.map((tournament) => {
    const rewards = tournament.rewards as unknown as { userWon?: boolean } | null;
    const championSnapshot = tournament.searchApiCall.snapshots.find(
      (snapshot) => snapshot.stay22PropertyId === tournament.championPropertyId,
    );
    const champion = championSnapshot?.normalizedData as
      | NormalizedAccommodation
      | undefined;

    return {
      tournamentId: tournament.id,
      mode: tournament.mode as "trip" | "world",
      createdAt: tournament.createdAt.toISOString(),
      userWon: Boolean(rewards?.userWon),
      winner: champion?.name ?? "Champion unavailable",
    };
  });
}

export async function getTournamentReplay(user: User, tournamentId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, userId: user.id },
  });
  if (!tournament) throw new ApiError(404, "Tournament not found");

  const search = await loadSearch(tournament.searchApiCallId, user.id);
  const engine = tournament.engineResult as unknown as EngineResult;
  const bracket = tournament.bracket as unknown as TournamentBracket;
  const contenderIds = tournament.contenderPropertyIds as unknown as string[];

  const hotelById = new Map(search.pool.map((h) => [h.id, h]));
  const prices = poolPriceContext(
    search.pool.filter((h) => engine.eligibleIds.includes(h.id)),
  );

  const selectedCardIds = tournament.userCardIds as unknown as string[];
  const userCards = await prisma.savedCard.findMany({
    where: { userId: user.id, id: { in: selectedCardIds } },
  });
  const userCardByProperty = new Map(userCards.map((c) => [c.stay22PropertyId, c]));

  const rankById = new Map(engine.ranking.map((r, i) => [r.hotelId, { ...r, rank: i + 1 }]));

  const contenders = contenderIds
    .map((propertyId) => {
      const hotel = hotelById.get(propertyId) as NormalizedAccommodation | undefined;
      if (!hotel) return null;
      const card = userCardByProperty.get(propertyId);
      const stats = computeCardStats(hotel, prices);
      const rarity = resolveTournamentRarity(propertyId, tournament.seed, card?.rarity);
      const engineStats = rankById.get(propertyId);
      return {
        propertyId,
        hotel,
        stats,
        overall: collectibleOverallRating(stats, rarity),
        rarity,
        isUserCard: Boolean(card),
        engine: engineStats
          ? {
              rank: engineStats.rank,
              deterministicScore: engineStats.deterministicScore,
              firstPlaceProbability: engineStats.firstPlaceProbability,
              topThreeProbability: engineStats.topThreeProbability,
            }
          : null,
      };
    })
    .filter((c) => c !== null);

  const championHotel = hotelById.get(tournament.championPropertyId) ?? null;
  const safest = engine.explanation.safestAlternativeId
    ? hotelById.get(engine.explanation.safestAlternativeId) ?? null
    : null;

  return {
    id: tournament.id,
    mode: tournament.mode,
    createdAt: tournament.createdAt,
    seed: tournament.seed,
    trip: search.trip,
    searchId: search.apiCallId,
    contenders,
    groups: bracket.groups,
    knockout: bracket.knockout,
    championId: tournament.championPropertyId,
    runnerUpId: bracket.runnerUpId,
    champion: championHotel
      ? {
          hotel: championHotel,
          winProbability: engine.championWinProbability,
          weights: engine.weights,
          activeMetrics: engine.activeMetrics,
          evidence: engine.championVsRunnerUp,
          explanation: engine.explanation,
          safestAlternative: safest ? { id: safest.id, name: safest.name } : null,
          engineVersion: engine.version,
        }
      : null,
    rewards: tournament.rewards,
  };
}
