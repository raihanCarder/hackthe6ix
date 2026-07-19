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

/**
 * Deterministic, fact-bound commentary. This function has no network access and
 * cannot affect rankings, match results, or the final recommendation.
 */
export function commentaryCandidates(event: PresentationEvent): string[] {
  switch (event.kind) {
    case "journey.moment":
      return JOURNEY_COMMENTARY[event.moment];
    case "card.selection":
      return [
        `${event.hotelName} gets the armband. Bold selection. The manager looks confident, so everyone else will pretend they are too.`,
        `${event.hotelName} is the captain. The opposition has immediately requested a much longer tactical meeting.`,
      ];
    case "competition.intro":
      return [
        `Welcome to ${event.competitionName}. ${event.contenderCount} hotels enter the field, and the scoring is locked in.`,
        `${event.competitionName} is under way. ${event.contenderCount} hotels are in contention, with the results already decided by the scoring system.`,
      ];
    case "matchup.introduction":
      return [
        `Next on the field: ${event.homeName} takes on ${event.awayName}.`,
        `Here comes the matchup: ${event.homeName} against ${event.awayName}.`,
      ];
    case "hotel.advantage": {
      const metric = METRIC_LABELS[event.metric] ?? event.metric;
      return [
        `A major edge for ${event.hotelName}: the engine ranks ${metric} among its strongest advantages over ${event.opponentName}.`,
        `${event.hotelName} makes its case on ${metric}, a leading advantage over ${event.opponentName}.`,
      ];
    }
    case "match.winner":
      return [
        `Full time. ${event.winnerName} beats ${event.loserName}, ${event.winnerGoals} to ${event.loserGoals}.`,
        `The final whistle goes. ${event.winnerName} takes the matchup over ${event.loserName}, ${event.winnerGoals} to ${event.loserGoals}.`,
      ];
    case "match.goal": {
      const minute = ordinal(event.minute);
      return [
        `Goal! ${event.scorerName} scores in the ${minute}. It is ${event.scorerGoals} to ${event.opponentGoals} against ${event.opponentName}.`,
        `${event.scorerName} finds the net! ${event.scorerGoals} to ${event.opponentGoals}, and ${event.opponentName} needs an answer.`,
        `What a finish from ${event.scorerName}! Room service delivery: perfect. ${event.scorerGoals} to ${event.opponentGoals}.`,
      ];
    }
    case "competition.champion":
      return [
        `${event.championName} lifts the trophy as the ${event.competitionName} champion.`,
        `We have a champion. ${event.championName} wins the ${event.competitionName}.`,
      ];
  }
}

export function renderCommentary(event: PresentationEvent, selectedIndex?: number): string {
  const choices = commentaryCandidates(event);
  const index = selectedIndex === undefined ? variant(event.id, choices.length) : selectedIndex;
  return choices[index] ?? choices[variant(event.id, choices.length)];
}

export function commentaryTemplateVersion(): string {
  return TEMPLATE_VERSION;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

const JOURNEY_COMMENTARY: Record<
  Extract<PresentationEvent, { kind: "journey.moment" }>["moment"],
  string[]
> = {
  welcome: [
    "Welcome to Check-In Champions. The hotels are warmed up, the scouts are ready, and the minibar remains tactically unavailable.",
    "Matchday begins now. Real hotels, real bookings, and one commentator who definitely packed too many football metaphors.",
  ],
  "pack.selection": [
    "First decision of the day: a Trip Pack or a Global Pack. The scouting department has prepared two clipboards.",
    "Choose your pack. One follows your travel plans; the other lets geography make a dramatic substitution.",
  ],
  "pack.trip_selected": [
    "Trip Pack selected. Real dates, real hotels, and absolutely no pressure on the scouting department.",
    "A Trip Pack it is. Set the fixture details and the scouts will find the contenders.",
  ],
  "pack.global_selected": [
    "Global Pack selected. Geography has officially entered the transfer window.",
    "Going global. The destination is a surprise, which is excellent news for the commentator and concerning news for the luggage.",
  ],
  "search.started": [
    "The scouts are out. Clipboards ready, booking data open, dramatic touchline pacing under way.",
    "Scouting has begun. We are checking the field, not guessing the facts.",
  ],
  "search.complete": [
    "The scouting report is in. The contenders are real, bookable, and blissfully unaware they are about to become football cards.",
    "Scouts are back with the shortlist. Somehow, every clipboard survived.",
  ],
  "pack.opening": [
    "The foil is coming off. Somewhere, a hotel lobby has just become very nervous.",
    "Pack opening time. Five signings, zero transfer paperwork, maximum unnecessary suspense.",
  ],
  "pack.reveal": [
    "A new signing steps onto the pitch. The scouting department is nodding like this was always the plan.",
    "Card revealed. A confident entrance, strong lighting, and absolutely no agent fee.",
  ],
  "pack.complete": [
    "The full squad is in. Five cards ready, one collection improved, and the tactics board suddenly overcrowded.",
    "Pack complete. The new signings are assembled and the dressing room snack budget is already under review.",
  ],
  "play.mode_selection": [
    "Choose the competition. Trip Cup means recommendation business; Global Cup means the passport gets no rest.",
    "Time to pick a tournament. The trophy is polished and the bracket is pretending not to be nervous.",
  ],
  "play.trip_selected": [
    "Trip Cup selected. Your preferences call the tactics; the recommendation engine keeps the score.",
    "Trip Cup it is. First a quick interview, then the hotels settle it on the data.",
  ],
  "play.global_selected": [
    "Global Cup selected. Serious trophy, casual competition, heroic levels of imaginary jet lag.",
    "The Global Cup is on. Fifteen international opponents and not one airport connection to miss.",
  ],
  "questionnaire.started": [
    "Pre-match interview time. A few answers will shape the tactics, and no, parking the bus is not an accommodation preference.",
    "The manager faces the microphones. Every answer tunes the recommendation; the commentator promises only one bad joke.",
  ],
  "questionnaire.answer": [
    "Answer locked in. The tactics board nods mysteriously.",
    "Preference recorded. Somewhere, a spreadsheet just celebrated quietly.",
  ],
  "tournament.simulating": [
    "The engine is running the numbers. The drama is for show; the recommendation stays grounded in the data.",
    "Simulation under way. Thousands of preference scenarios, one trophy, and a commentator avoiding the calculator.",
  ],
};
