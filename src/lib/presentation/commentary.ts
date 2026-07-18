import type { PresentationEvent } from "./types";

const METRIC_LABELS: Record<string, string> = {
  quality: "guest review quality",
  location: "location",
  groupFit: "space for the traveling party",
  flexibility: "booking flexibility",
  dataConfidence: "listing confidence",
  value: "value",
};

const TEMPLATE_VERSION = "commentary-v1";

function variant(id: string, count: number): number {
  let hash = 2166136261;
  for (const character of `${TEMPLATE_VERSION}:${id}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

function select(id: string, choices: string[]): string {
  return choices[variant(id, choices.length)];
}

/**
 * Deterministic, fact-bound commentary. This function has no network access and
 * cannot affect rankings, match results, or the final recommendation.
 */
export function renderCommentary(event: PresentationEvent): string {
  switch (event.kind) {
    case "competition.intro":
      return select(event.id, [
        `Welcome to ${event.competitionName}. ${event.contenderCount} hotels enter the field, and the scoring is locked in.`,
        `${event.competitionName} is under way. ${event.contenderCount} hotels are in contention, with the results already decided by the scoring system.`,
      ]);
    case "matchup.introduction":
      return select(event.id, [
        `Next on the field: ${event.homeName} takes on ${event.awayName}.`,
        `Here comes the matchup: ${event.homeName} against ${event.awayName}.`,
      ]);
    case "hotel.advantage": {
      const metric = METRIC_LABELS[event.metric] ?? event.metric;
      return select(event.id, [
        `A major edge for ${event.hotelName}: the engine ranks ${metric} among its strongest advantages over ${event.opponentName}.`,
        `${event.hotelName} makes its case on ${metric}, a leading advantage over ${event.opponentName}.`,
      ]);
    }
    case "match.winner":
      return select(event.id, [
        `Full time. ${event.winnerName} beats ${event.loserName}, ${event.winnerGoals} to ${event.loserGoals}.`,
        `The final whistle goes. ${event.winnerName} takes the matchup over ${event.loserName}, ${event.winnerGoals} to ${event.loserGoals}.`,
      ]);
    case "competition.champion":
      return select(event.id, [
        `${event.championName} lifts the trophy as the ${event.competitionName} champion.`,
        `We have a champion. ${event.championName} wins the ${event.competitionName}.`,
      ]);
  }
}

export function commentaryTemplateVersion(): string {
  return TEMPLATE_VERSION;
}
