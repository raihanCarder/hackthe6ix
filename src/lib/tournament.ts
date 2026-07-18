import "server-only";
import { runEngine } from "@/lib/engine";
import type {
  EngineResult,
  HotelRankStats,
  NormalizedAccommodation,
  TravelerAnswer,
} from "@/lib/engine/types";
import { createRng, hashString } from "@/lib/engine/seed";
import { buildBracketContenders } from "@/lib/game/bracket";
import { simulateTournament, type TournamentBracket } from "@/lib/game/matchSim";
import { computeCardStats, overallRating, poolPriceContext } from "@/lib/game/cardStats";
import { computeTournamentRewards, levelForXp, type TournamentRewards } from "@/lib/game/rewards";
import { pickUniqueCountryCities } from "@/lib/data/worldCities";
import { searchAccommodations } from "@/lib/stay22/client";
import { ApiError, asJson } from "@/lib/api/core";
import { loadSearch } from "@/lib/api/searches";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

const GLOBAL_CUP_OPPONENTS = 15;

interface UserCardRef {
  id: string;
  stay22PropertyId: string;
}

interface PersistTournamentArgs {
  user: User;
  mode: "trip" | "world";
  searchApiCallId: string;
  contenderPropertyIds: string[];
  userCards: UserCardRef[];
  questionnaireAnswers: TravelerAnswer[];
  engineResult: EngineResult;
  seed: string;
  championPropertyId: string;
  bracket: TournamentBracket;
  rewards: TournamentRewards;
}

/**
 * Shared persistence tail for both game modes: one atomic write of the
 * Tournament row plus user/card progression. The bracket and rewards are
 * already computed by the caller — this never decides who wins.
 */
async function persistTournament(args: PersistTournamentArgs) {
  const {
    user,
    mode,
    searchApiCallId,
    contenderPropertyIds,
    userCards,
    questionnaireAnswers,
    engineResult,
    seed,
    championPropertyId,
    bracket,
    rewards,
  } = args;

  const tournament = await prisma.$transaction(async (tx) => {
    const record = await tx.tournament.create({
      data: {
        userId: user.id,
        mode,
        searchApiCallId,
        contenderPropertyIds: asJson(contenderPropertyIds),
        userCardIds: asJson(userCards.map((c) => c.id)),
        questionnaireAnswers: asJson(questionnaireAnswers),
        engineResult: asJson(engineResult),
        seed,
        championPropertyId,
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

  return { tournament, engine: engineResult, bracket, rewards };
}

export interface RunTripTournamentArgs {
  user: User;
  cardId: string;
  answers: TravelerAnswer[];
}

/**
 * Trip Cup Mode: real recommendations. Opponents are drawn from the same
 * live Stay22 search that produced the user's chosen card, so the engine's
 * #1 recommendation is always the tournament champion — the bracket only
 * dramatizes it.
 */
export async function createTripTournament(args: RunTripTournamentArgs) {
  const { user, cardId, answers } = args;

  const card = await prisma.savedCard.findFirst({
    where: { id: cardId, userId: user.id },
    include: { snapshot: true },
  });
  if (!card) throw new ApiError(404, "Card not found");

  const search = await loadSearch(card.snapshot.sourceApiCallId, user.id);

  let engine: EngineResult;
  try {
    engine = runEngine({ trip: search.trip, hotels: search.pool, answers });
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : "Engine run failed");
  }

  if (!engine.eligibleIds.includes(card.stay22PropertyId)) {
    throw new ApiError(422, "Your selected card isn't eligible for this trip anymore");
  }

  const eligibleSet = new Set(engine.eligibleIds);
  const eligibleHotels = search.pool.filter((h) => eligibleSet.has(h.id));
  const userPropertyIds = [card.stay22PropertyId];

  const plan = buildBracketContenders({
    eligible: eligibleHotels,
    ranking: engine.ranking,
    userPropertyIds,
    seed: engine.seed,
  });

  if (!plan.contenderIds.includes(engine.championId) || plan.contenderIds.length < 4) {
    throw new ApiError(422, "Could not build a bracket from this search");
  }

  const utilityById = new Map(engine.ranking.map((r) => [r.hotelId, r.deterministicScore]));
  const hotelsById = new Map(eligibleHotels.map((h) => [h.id, h]));
  const bracket = simulateTournament({
    groups: plan.groups,
    championId: engine.championId,
    utilityById,
    hotelsById,
    seed: engine.seed,
  });

  const rewards = computeTournamentRewards(bracket, userPropertyIds);

  return persistTournament({
    user,
    mode: "trip",
    searchApiCallId: search.apiCallId,
    contenderPropertyIds: plan.contenderIds,
    userCards: [{ id: card.id, stay22PropertyId: card.stay22PropertyId }],
    questionnaireAnswers: answers,
    engineResult: engine,
    seed: engine.seed,
    championPropertyId: bracket.championId,
    bracket,
    rewards,
  });
}

export interface RunGlobalTournamentArgs {
  user: User;
  cardId: string;
}

/**
 * Global Cup Mode: casual, for-fun play. Opponents are generated on the fly
 * — one hotel each from 15 unique countries — and matched against the
 * user's chosen card. There's no personalized recommendation engine here,
 * so the champion is simply the highest OVERALL-rated card; the sim itself
 * is reused unchanged with extra spectacle from its built-in noise.
 */
export async function createGlobalTournament(args: RunGlobalTournamentArgs) {
  const { user, cardId } = args;

  const card = await prisma.savedCard.findFirst({
    where: { id: cardId, userId: user.id },
    include: { snapshot: { include: { sourceApiCall: true } } },
  });
  if (!card) throw new ApiError(404, "Card not found");

  const userHotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
  const seed = hashString(`global-cup:${user.id}:${card.id}:${user.matchesPlayed}`);
  const rng = createRng(seed);
  const cities = pickUniqueCountryCities(rng, GLOBAL_CUP_OPPONENTS);
  const sourceParams = card.snapshot.sourceApiCall.requestParams as Record<string, unknown>;
  const globalTrip = globalCupTrip(sourceParams);

  const opponentResults = await Promise.all(
    cities.map((city) =>
      searchAccommodations({
        address: `${city.city}, ${city.country}`,
        checkin: globalTrip.checkin,
        checkout: globalTrip.checkout,
        adults: globalTrip.adults,
        children: globalTrip.children,
        rooms: globalTrip.rooms,
        currency: globalTrip.currency,
      }),
    ),
  );

  const opponents: NormalizedAccommodation[] = [];
  const usedPropertyIds = new Set([userHotel.id]);
  opponentResults.forEach((result) => {
    const sorted = [...result.hotels]
      .filter((hotel) => !usedPropertyIds.has(hotel.id))
      .sort(
        (a, b) =>
          (b.guestRating ?? -1) - (a.guestRating ?? -1) ||
          (b.reviewCount ?? -1) - (a.reviewCount ?? -1) ||
          (a.id < b.id ? -1 : 1),
      );
    if (sorted.length === 0) return;
    opponents.push(sorted[0]);
    usedPropertyIds.add(sorted[0].id);
  });

  if (opponents.length !== GLOBAL_CUP_OPPONENTS) {
    throw new ApiError(
      422,
      `Global Cup needs ${GLOBAL_CUP_OPPONENTS} unique opponents; found ${opponents.length}`,
    );
  }

  const pool = [userHotel, ...opponents];
  const prices = poolPriceContext(pool);
  const rankEntries = pool.map((hotel) => {
    const stats = computeCardStats(hotel, prices);
    return { hotelId: hotel.id, overall: overallRating(stats) };
  });
  const sorted = [...rankEntries].sort(
    (a, b) => b.overall - a.overall || (a.hotelId < b.hotelId ? -1 : 1),
  );
  const overallGap = sorted.length > 1 ? sorted[0].overall - sorted[1].overall : 0;
  const championProbability = Math.min(0.95, 0.55 + overallGap / 50);
  const remainingProbability = (1 - championProbability) / Math.max(1, sorted.length - 1);
  const ranking: HotelRankStats[] = sorted.map((entry, index) => ({
    hotelId: entry.hotelId,
    deterministicScore: entry.overall,
    firstPlaceProbability: index === 0 ? championProbability : remainingProbability,
    topThreeProbability: index < 3 ? 1 : 0,
    averageRank: index + 1,
    medianRank: index + 1,
    averageUtility: entry.overall,
  }));

  const championId = ranking[0].hotelId;
  const runnerUpId = ranking[1]?.hotelId ?? null;

  const engineResult: EngineResult = {
    version: "card-overall-v1",
    seed,
    config: { count: 0, concentration: 0, seed, algorithmVersion: "global-cup" },
    eligibleIds: pool.map((h) => h.id),
    excluded: [],
    metricsById: {},
    availability: [],
    activeMetrics: [],
    weightSource: { kind: "profile", profile: "global_cup" },
    points: {},
    weights: {},
    ranking,
    regret: [],
    explanation: {
      leaderId: championId,
      mainReasons: [],
      stability: { firstPlaceProbability: ranking[0].firstPlaceProbability, gap: overallGap },
      safestAlternativeId: null,
      caveats: ["Casual Global Cup — for fun, not a personalized recommendation."],
    },
    championId,
    runnerUpId,
    championVsRunnerUp: null,
    championWinProbability: ranking[0].firstPlaceProbability,
  };

  const plan = buildBracketContenders({
    eligible: pool,
    ranking,
    userPropertyIds: [userHotel.id],
    seed,
  });

  if (!plan.contenderIds.includes(championId) || plan.contenderIds.length !== 16) {
    throw new ApiError(422, "Could not build a Global Cup bracket — try again");
  }

  const utilityById = new Map(ranking.map((r) => [r.hotelId, r.deterministicScore]));
  const hotelsById = new Map(pool.map((h) => [h.id, h]));
  const bracket = simulateTournament({
    groups: plan.groups,
    championId,
    utilityById,
    hotelsById,
    seed,
  });

  const rewards = computeTournamentRewards(bracket, [userHotel.id]);

  // Persist a synthetic Stay22 call + snapshots so the pool can be replayed
  // (same contract as a real search: loadSearch rebuilds it later).
  const apiCall = await prisma.stay22ApiCall.create({
    data: {
      userId: user.id,
      endpoint: "global://world-cup",
      requestParams: asJson({
        destination: { lat: 0, lng: 0, label: "Global Cup" },
        checkin: globalTrip.checkin,
        checkout: globalTrip.checkout,
        adults: globalTrip.adults,
        children: globalTrip.children,
        rooms: globalTrip.rooms,
        currency: globalTrip.currency,
        countries: cities.map((c) => c.country),
      }),
      responseBody: asJson({
        note: "synthetic Global Cup opponent pool",
        countries: cities.map((c) => c.country),
        results: pool,
      }),
      status: 200,
      snapshots: {
        create: pool.map((hotel) => ({
          stay22PropertyId: hotel.id,
          normalizedData: asJson(hotel),
        })),
      },
    },
  });

  return persistTournament({
    user,
    mode: "world",
    searchApiCallId: apiCall.id,
    contenderPropertyIds: plan.contenderIds,
    userCards: [{ id: card.id, stay22PropertyId: userHotel.id }],
    questionnaireAnswers: [],
    engineResult,
    seed,
    championPropertyId: bracket.championId,
    bracket,
    rewards,
  });
}

function globalCupTrip(params: Record<string, unknown>): {
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  rooms: number;
  currency: string;
} {
  const sourceCheckin = typeof params.checkin === "string" ? params.checkin : "";
  const sourceCheckout = typeof params.checkout === "string" ? params.checkout : "";
  const todayIso = new Date().toISOString().slice(0, 10);
  const datesAreUsable = sourceCheckin >= todayIso && sourceCheckout > sourceCheckin;
  const fallback = defaultGlobalCupDates();
  return {
    checkin: datesAreUsable ? sourceCheckin : fallback.checkin,
    checkout: datesAreUsable ? sourceCheckout : fallback.checkout,
    adults: positiveInteger(params.adults, 2),
    children: nonNegativeInteger(params.children, 0),
    rooms: positiveInteger(params.rooms, 1),
    currency: typeof params.currency === "string" && params.currency ? params.currency : "CAD",
  };
}

function defaultGlobalCupDates(): { checkin: string; checkout: string } {
  const today = new Date();
  const checkinDate = new Date(today);
  checkinDate.setDate(checkinDate.getDate() + 21);
  const checkoutDate = new Date(today);
  checkoutDate.setDate(checkoutDate.getDate() + 24);
  return {
    checkin: checkinDate.toISOString().slice(0, 10),
    checkout: checkoutDate.toISOString().slice(0, 10),
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

export type { TournamentBracket, TournamentRewards };
