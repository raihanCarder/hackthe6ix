export type PresentationEvent =
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
      kind: "competition.champion";
      championName: string;
      competitionName: string;
    };

export type PresentationCue =
  | { kind: "competition.intro" }
  | {
      kind: "matchup.introduction" | "match.winner";
      homeId: string;
      awayId: string;
    }
  | { kind: "hotel.advantage"; advantageIndex: number }
  | { kind: "competition.champion" };

export interface CommentaryResponse {
  event: PresentationEvent;
  caption: string;
  audioUrl: string | null;
  audioStatus: "ready" | "not_requested" | "disabled" | "quota" | "unavailable";
}
