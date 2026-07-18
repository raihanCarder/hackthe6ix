import "server-only";
import { runEngine } from "@/lib/engine";
import type { EngineResult, NormalizedAccommodation, TravelerAnswer, TripContext } from "@/lib/engine/types";
import { buildBracketContenders } from "@/lib/game/bracket";
import { simulateTournament, type TournamentBracket } from "@/lib/game/matchSim";
import { computeTournamentRewards, levelForXp, type TournamentRewards } from "@/lib/game/rewards";
import { ApiError, asJson } from "@/lib/api/core";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export interface RunTournamentArgs {
  user: User;
  searchApiCallId: string;
  trip: TripContext;
  pool: NormalizedAccommodation[];
  answers: TravelerAnswer[];
}

/**
 * One deterministic tournament run: engine → bracket → hybrid sim →
 * rewards, persisted atomically. The engine's champion is the
 * recommendation; the bracket can only dramatize it.
 */
export async function createTournament(args: RunTournamentArgs) {
  const { user } = args;

  let engine: EngineResult;
  try {
    engine = runEngine({ trip: args.trip, hotels: args.pool, answers: args.answers });
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : "Engine run failed");
  }

  const eligibleSet = new Set(engine.eligibleIds);
  const eligibleHotels = args.pool.filter((h) => eligibleSet.has(h.id));

  const userCards = await prisma.savedCard.findMany({
    where: { userId: user.id, stay22PropertyId: { in: engine.eligibleIds } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const userPropertyIds = userCards.map((c) => c.stay22PropertyId);

  const plan = buildBracketContenders({
    eligible: eligibleHotels,
    ranking: engine.ranking,
    userPropertyIds,
    seed: engine.seed,
  });

  const utilityById = new Map(engine.ranking.map((r) => [r.hotelId, r.deterministicScore]));
  const hotelsById = new Map(eligibleHotels.map((h) => [h.id, h]));
  let bracket: TournamentBracket;
  let championId = engine.championId;

  if (plan.contenderIds.includes(engine.championId) && plan.contenderIds.length >= 4) {
    bracket = simulateTournament({
      groups: plan.groups,
      championId: engine.championId,
      utilityById,
      hotelsById,
      seed: engine.seed,
    });
    championId = bracket.championId; // equals engine.championId by invariant
  } else {
    throw new ApiError(422, "Could not build a bracket from this search");
  }

  const rewards = computeTournamentRewards(bracket, userPropertyIds);

  const tournament = await prisma.$transaction(async (tx) => {
    const record = await tx.tournament.create({
      data: {
        userId: user.id,
        mode: "trip",
        searchApiCallId: args.searchApiCallId,
        contenderPropertyIds: asJson(plan.contenderIds),
        userCardIds: asJson(userCards.map((c) => c.id)),
        questionnaireAnswers: asJson(args.answers),
        engineResult: asJson(engine),
        seed: engine.seed,
        championPropertyId: championId,
        bracket: asJson(bracket),
        rewards: asJson(rewards),
      },
    });

    const newXp = user.xp + rewards.userXp;
    await tx.user.update({
      where: { id: user.id },
      data: {
        xp: newXp,
        level: levelForXp(newXp),
        currency: { increment: rewards.userCurrency },
        matchesPlayed: { increment: 1 },
        wins: { increment: rewards.userWon ? 1 : 0 },
        losses: { increment: rewards.userWon ? 0 : 1 },
        currentWinStreak: rewards.userWon ? user.currentWinStreak + 1 : 0,
        bestWinStreak: rewards.userWon
          ? Math.max(user.bestWinStreak, user.currentWinStreak + 1)
          : user.bestWinStreak,
        mvpCount: { increment: rewards.userWon ? 1 : 0 },
      },
    });

    for (const outcome of rewards.cardOutcomes) {
      const card = userCards.find((c) => c.stay22PropertyId === outcome.propertyId);
      if (!card) continue;
      await tx.savedCard.update({
        where: { id: card.id },
        data: {
          wins: { increment: outcome.wins },
          losses: { increment: outcome.losses },
          xp: { increment: outcome.xp },
          trophies: { increment: outcome.trophies },
          timesMvp: { increment: outcome.becameMvp ? 1 : 0 },
        },
      });
    }

    return record;
  });

  return { tournament, engine, bracket, rewards };
}

export type { TournamentBracket, TournamentRewards };
