import "server-only";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import type { EngineResult, NormalizedAccommodation } from "@/lib/engine/types";
import { normalizeTravelerAnswers } from "@/lib/engine";
import { computeCardStats, overallRating, poolPriceContext } from "@/lib/game/cardStats";
import type { TournamentBracket } from "@/lib/game/matchSim";
import { createTournament } from "@/lib/tournament";
import { prisma } from "@/lib/db";
import { ApiError } from "./core";
import { answersSchema, loadSearch } from "./searches";

export const createTournamentSchema = z.object({
  searchId: z.string().min(1),
  answers: answersSchema,
});

export async function createTournamentForSearch(
  user: User,
  body: z.infer<typeof createTournamentSchema>,
) {
  const search = await loadSearch(body.searchId, user.id);
  const answers = normalizeTravelerAnswers(body.answers);

  const { tournament } = await createTournament({
    user,
    searchApiCallId: search.apiCallId,
    trip: search.trip,
    pool: search.pool,
    answers,
  });

  return { tournamentId: tournament.id };
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

  const userCards = await prisma.savedCard.findMany({
    where: { userId: user.id, stay22PropertyId: { in: contenderIds } },
  });
  const userCardByProperty = new Map(userCards.map((c) => [c.stay22PropertyId, c]));

  const rankById = new Map(engine.ranking.map((r, i) => [r.hotelId, { ...r, rank: i + 1 }]));

  const contenders = contenderIds
    .map((propertyId) => {
      const hotel = hotelById.get(propertyId) as NormalizedAccommodation | undefined;
      if (!hotel) return null;
      const card = userCardByProperty.get(propertyId);
      const cosmeticSeed = card?.cosmeticSeed ?? `npc:${tournament.seed}:${propertyId}`;
      const stats = computeCardStats(hotel, prices, cosmeticSeed);
      const engineStats = rankById.get(propertyId);
      return {
        propertyId,
        hotel,
        stats,
        overall: overallRating(stats),
        rarity: card?.rarity ?? null,
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
