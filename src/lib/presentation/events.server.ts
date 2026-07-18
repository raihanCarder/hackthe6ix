import "server-only";
import type { User } from "@/generated/prisma/client";
import { getTournamentReplay } from "@/lib/api/tournaments";
import type { MatchResult } from "@/lib/game/matchSim";
import { ApiError } from "@/lib/api/core";
import type { PresentationCue, PresentationEvent } from "./types";

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
