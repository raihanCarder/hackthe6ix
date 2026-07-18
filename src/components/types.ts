import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";

export interface CardPayload {
  id: string;
  propertyId: string;
  rarity: Rarity;
  cosmeticSeed: string;
  stats: CardStats;
  overall: number;
  hotel: NormalizedAccommodation;
  acquiredCity?: string;
  acquiredScope?: string;
  sourceApiCallId?: string;
  xp?: number;
  trophies?: number;
  wins?: number;
  losses?: number;
  timesMvp?: number;
}

export interface ContenderPayload {
  propertyId: string;
  hotel: NormalizedAccommodation;
  stats: CardStats;
  overall: number;
  rarity: Rarity | null;
  isUserCard: boolean;
  engine: {
    rank: number;
    deterministicScore: number;
    firstPlaceProbability: number;
    topThreeProbability: number;
  } | null;
}
