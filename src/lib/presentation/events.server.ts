import "server-only";
import type { User } from "@/generated/prisma/client";
import { getTournamentReplay } from "@/lib/api/tournaments";
import type { MatchResult } from "@/lib/game/matchSim";
import { buildPlaybackTimeline } from "@/lib/presentation/matchPlayback";
import { ApiError } from "@/lib/api/core";
import { prisma } from "@/lib/db";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { PresentationCue, PresentationEvent } from "./types";

export function resolveJourneyEvent(
  moment: Extract<PresentationEvent, { kind: "journey.moment" }>["moment"],
): PresentationEvent {
  return { version: 1, id: `journey:${moment}`, kind: "journey.moment", moment };
}

export async function resolveCardSelectionEvent(
  user: User,
  cardId: string,
): Promise<PresentationEvent> {
  const card = await prisma.savedCard.findFirst({
    where: { id: cardId, userId: user.id },
    include: { snapshot: true },
  });
  if (!card) throw new ApiError(404, "Card not found");
  const hotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
  if (!hotel.name) throw new ApiError(422, "This card has no hotel name to announce");
  return {
    version: 1,
    id: `card:${card.id}:selection`,
    kind: "card.selection",
    hotelName: hotel.name,
  };
}

function hotelName(
  contenders: Awaited<ReturnType<typeof getTournamentReplay>>["contenders"],
  propertyId: string,
): string {
  return contenders.find((contender) => contender.propertyId === propertyId)?.hotel.name ?? "Unknown hotel";
}

function findMatch(
  replay: Awaited<ReturnType<typeof getTournamentReplay>>,
  homeId: string,
  awayId: string,
): MatchResult {
  const matches = [
    ...replay.groups.flatMap((group) => group.matches),
    ...replay.knockout.flatMap((round) => round.matches),
  ];
  const match = matches.find((candidate) => candidate.homeId === homeId && candidate.awayId === awayId);
  if (!match) throw new ApiError(404, "Match not found in this tournament");
  return match;
}

/** Resolve lightweight client cues against stored, trusted tournament facts. */
export async function resolvePresentationEvent(
  user: User,
  tournamentId: string,
  cue: PresentationCue,
): Promise<PresentationEvent> {
  const replay = await getTournamentReplay(user, tournamentId);
  const competitionName = replay.mode === "world" ? "Global Cup" : "Trip Cup";

  switch (cue.kind) {
    case "competition.intro":
      return {
        version: 1,
        id: `${replay.id}:intro`,
        kind: cue.kind,
        competitionName,
        contenderCount: replay.contenders.length,
      };
    case "matchup.introduction": {
      const match = findMatch(replay, cue.homeId, cue.awayId);
      return {
        version: 1,
        id: `${replay.id}:matchup:${match.homeId}:${match.awayId}`,
        kind: cue.kind,
        homeName: hotelName(replay.contenders, match.homeId),
        awayName: hotelName(replay.contenders, match.awayId),
      };
    }
    case "match.winner": {
      const match = findMatch(replay, cue.homeId, cue.awayId);
      const loserId = match.winnerId === match.homeId ? match.awayId : match.homeId;
      return {
        version: 1,
        id: `${replay.id}:winner:${match.homeId}:${match.awayId}`,
        kind: cue.kind,
        winnerName: hotelName(replay.contenders, match.winnerId),
        loserName: hotelName(replay.contenders, loserId),
        winnerGoals: match.winnerId === match.homeId ? match.homeGoals : match.awayGoals,
        loserGoals: match.winnerId === match.homeId ? match.awayGoals : match.homeGoals,
      };
    }
    case "match.goal": {
      const match = findMatch(replay, cue.homeId, cue.awayId);
      const goal = buildPlaybackTimeline(match, { seed: replay.seed }).events
        .filter((event) => event.kind === "goal")[cue.goalIndex];
      if (!goal) throw new ApiError(404, "Goal not found in this match");
      const opponentId = goal.propertyId === match.homeId ? match.awayId : match.homeId;
      return {
        version: 1,
        id: `${replay.id}:goal:${match.homeId}:${match.awayId}:${cue.goalIndex}`,
        kind: cue.kind,
        scorerName: hotelName(replay.contenders, goal.propertyId),
        opponentName: hotelName(replay.contenders, opponentId),
        minute: goal.minute,
        scorerGoals: goal.side === "home" ? goal.homeScore : goal.awayScore,
        opponentGoals: goal.side === "home" ? goal.awayScore : goal.homeScore,
      };
    }
    case "hotel.advantage": {
      const advantage = replay.champion?.evidence?.mainAdvantages[cue.advantageIndex];
      if (!advantage) throw new ApiError(404, "Champion advantage not available");
      return {
        version: 1,
        id: `${replay.id}:advantage:${cue.advantageIndex}`,
        kind: cue.kind,
        hotelName: hotelName(replay.contenders, replay.championId),
        opponentName: hotelName(replay.contenders, replay.runnerUpId),
        metric: advantage.metric,
      };
    }
    case "competition.champion":
      return {
        version: 1,
        id: `${replay.id}:champion`,
        kind: cue.kind,
        championName: hotelName(replay.contenders, replay.championId),
        competitionName,
      };
  }
}
