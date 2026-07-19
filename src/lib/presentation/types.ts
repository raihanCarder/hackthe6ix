export type JourneyMoment =
  | "welcome"
  | "pack.selection"
  | "pack.trip_selected"
  | "pack.global_selected"
  | "search.started"
  | "search.complete"
  | "pack.opening"
  | "pack.reveal"
  | "pack.complete"
  | "play.mode_selection"
  | "play.trip_selected"
  | "play.global_selected"
  | "questionnaire.started"
  | "questionnaire.answer"
  | "tournament.simulating";

export type PresentationEvent =
  | {
      version: 1;
      id: string;
      kind: "journey.moment";
      moment: JourneyMoment;
    }
  | {
      version: 1;
      id: string;
      kind: "card.selection";
      hotelName: string;
    }
  | {
      version: 1;
      id: string;
      kind: "competition.intro";
      competitionName: string;
      contenderCount: number;
    }
  | {
      version: 1;
      id: string;
      kind: "matchup.introduction";
      homeName: string;
      awayName: string;
    }
  | {
      version: 1;
      id: string;
      kind: "hotel.advantage";
      hotelName: string;
      opponentName: string;
      metric: string;
    }
  | {
      version: 1;
      id: string;
      kind: "match.winner";
      winnerName: string;
      loserName: string;
      winnerGoals: number;
      loserGoals: number;
    }
  | {
      version: 1;
      id: string;
      kind: "match.goal";
      scorerName: string;
      opponentName: string;
      minute: number;
      scorerGoals: number;
      opponentGoals: number;
    }
  | {
      version: 1;
      id: string;
      kind: "competition.champion";
      championName: string;
      competitionName: string;
    }
  | {
      version: 1;
      id: string;
      kind: "competition.recap";
      tournamentId: string;
      competitionName: string;
      destinationLabel: string | null;
      championName: string;
      runnerUpName: string;
      championGoals: number;
      runnerUpGoals: number;
      championWins: number;
      championMatches: number;
      mainAdvantages: string[];
      winProbabilityPercent: number | null;
      personalized: boolean;
      userWon: boolean;
      rewardXp: number;
      rewardCoins: number;
    };

export type PresentationCue =
  | { kind: "competition.intro" }
  | {
      kind: "matchup.introduction" | "match.winner";
      homeId: string;
      awayId: string;
    }
  | {
      kind: "match.goal";
      homeId: string;
      awayId: string;
      goalIndex: number;
    }
  | { kind: "hotel.advantage"; advantageIndex: number }
  | { kind: "competition.champion" | "competition.recap" };

export interface JourneyCue {
  kind: "journey.moment";
  moment: JourneyMoment;
}

export type CommentaryRequest =
  | { source: "journey"; cue: JourneyCue }
  | { source: "card"; cardId: string; cue: { kind: "card.selection" } }
  | { source: "tournament"; tournamentId: string; cue: PresentationCue };

export interface CommentaryResponse {
  event: PresentationEvent;
  caption: string;
  captionSource: "gemini" | "deterministic";
  audioUrl: string | null;
  audioStatus: "ready" | "not_requested" | "disabled" | "quota" | "unavailable";
}
