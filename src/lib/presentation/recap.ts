import type { PresentationEvent } from "./types";

export type TournamentRecapEvent = Extract<PresentationEvent, { kind: "competition.recap" }>;

const METRIC_LABELS: Record<string, string> = {
  quality: "guest review quality",
  location: "location",
  groupFit: "space for the traveling party",
  flexibility: "booking flexibility",
  dataConfidence: "listing confidence",
  value: "value",
};

/** Minimal trusted payload supplied to Gemini. It contains no raw Stay22 response. */
export function tournamentRecapFacts(event: TournamentRecapEvent) {
  return {
    competition: event.competitionName,
    destination: event.destinationLabel,
    champion: event.championName,
    runnerUp: event.runnerUpName,
    finalScore: {
      champion: event.championGoals,
      runnerUp: event.runnerUpGoals,
    },
    championRecord: {
      wins: event.championWins,
      matches: event.championMatches,
    },
    resultBasis: event.personalized
      ? "deterministic personalized recommendation engine"
      : "highest combined collectible card overall rating in a casual competition",
    engineAdvantages: event.mainAdvantages.map((metric) => METRIC_LABELS[metric] ?? metric),
    firstPlaceProbabilityPercent: event.winProbabilityPercent,
    userCardWon: event.userWon,
    rewards: { xp: event.rewardXp, coins: event.rewardCoins },
  };
}

/**
 * Reject prose containing unsupported numbers or common invented hotel claims.
 * Failure always falls back to deterministic fact-bound commentary.
 */
export function validateGeneratedRecap(
  value: string,
  event: TournamentRecapEvent,
): string | null {
  const recap = value.replace(/\s+/g, " ").trim();
  if (recap.length < 80 || recap.length > 550) return null;
  if (!recap.includes(event.championName) || !recap.includes(event.runnerUpName)) return null;
  if (!recap.includes(event.competitionName)) return null;

  const scorePatterns = [
    `${event.championGoals}-${event.runnerUpGoals}`,
    `${event.championGoals}–${event.runnerUpGoals}`,
    `${event.championGoals} to ${event.runnerUpGoals}`,
  ];
  if (!scorePatterns.some((score) => recap.includes(score))) return null;

  const trustedText = JSON.stringify(tournamentRecapFacts(event));
  const allowedNumbers = new Set(extractNumbers(trustedText));
  if (extractNumbers(recap).some((number) => !allowedNumbers.has(number))) return null;

  let claimsOnly = recap;
  const trustedPhrases = [
    event.championName,
    event.runnerUpName,
    event.competitionName,
    event.destinationLabel,
    ...event.mainAdvantages.map((metric) => METRIC_LABELS[metric] ?? metric),
  ].filter((phrase): phrase is string => Boolean(phrase));
  for (const phrase of trustedPhrases.sort((a, b) => b.length - a.length)) {
    claimsOnly = claimsOnly.replaceAll(phrase, "");
  }

  const unsupportedHotelClaim = /\b(pool|spa|gym|breakfast|airport|beach|parking|wi-?fi|restaurant|room service|balcony|downtown|transit|walking distance|stars?|rated|price|nightly|cheap|expensive|cancellation|amenit(?:y|ies)|beds?|bedrooms?|bathrooms?)\b/i;
  const unsupportedMatchClaim = /\b(comeback|upset|penalt(?:y|ies)|extra time|shutout|clean sheet|late winner|early goal|last-minute|stoppage|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
  if (unsupportedHotelClaim.test(claimsOnly) || unsupportedMatchClaim.test(claimsOnly)) return null;

  return recap;
}

function extractNumbers(value: string): string[] {
  return (value.match(/\d+(?:\.\d+)?%?/g) ?? []).map((number) => number.replace("%", ""));
}
