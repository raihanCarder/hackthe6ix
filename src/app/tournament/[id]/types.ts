import type { ContenderPayload } from "@/components/types";
import type { MetricContribution, NormalizedAccommodation } from "@/lib/engine/types";
import type { GroupResult, MatchResult } from "@/lib/game/matchSim";

export interface TournamentPayload {
  id: string;
  mode: "trip" | "world";
  seed: string;
  trip: { destinationLabel: string; checkin: string; checkout: string; adults: number; children: number };
  searchId: string;
  contenders: ContenderPayload[];
  groups: GroupResult[];
  knockout: { round: string; matches: MatchResult[] }[];
  championId: string;
  runnerUpId: string;
  champion: {
    hotel: NormalizedAccommodation;
    winProbability: number;
    weights: Record<string, number>;
    activeMetrics: string[];
    evidence: {
      mainAdvantages: MetricContribution[];
      opponentAdvantages: MetricContribution[];
      caveats: string[];
    } | null;
    explanation: { caveats: string[]; stability: { firstPlaceProbability: number; gap: number } };
    safestAlternative: { id: string; name: string | null } | null;
    engineVersion: string;
  } | null;
  rewards: {
    userXp: number;
    userCurrency: number;
    userWon: boolean;
  };
}

export const METRIC_LABELS: Record<string, string> = {
  quality: "Reviews",
  location: "Location",
  groupFit: "Space",
  flexibility: "Flexibility",
  dataConfidence: "Data confidence",
  value: "Value",
};

export const ROUND_LABELS: Record<string, string> = {
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "The Final",
};

/** "The Grand Plaza" → "Grand P." — used for the compact score buttons. */
export function shortName(full: string): string {
  const words = full.split(/\s+/);
  return words.length > 1 ? `${words[0]} ${words[1][0]}.` : full;
}
