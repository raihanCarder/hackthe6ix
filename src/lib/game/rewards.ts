import type { TournamentBracket } from "./matchSim";

/**
 * Post-tournament progression (IDEA.md). Rewards are flavor — they never
 * influence which hotel the engine recommends.
 */

export interface CardOutcome {
  propertyId: string;
  wins: number;
  losses: number;
  xp: number;
  trophies: number;
  becameMvp: boolean;
}

export interface TournamentRewards {
  userXp: number;
  userCurrency: number;
  userWon: boolean;
  cardOutcomes: CardOutcome[];
}

export function computeTournamentRewards(
  bracket: TournamentBracket,
  userPropertyIds: string[],
): TournamentRewards {
  const userSet = new Set(userPropertyIds);
  const outcomes = new Map<string, CardOutcome>(
    userPropertyIds.map((id) => [
      id,
      { propertyId: id, wins: 0, losses: 0, xp: 0, trophies: 0, becameMvp: false },
    ]),
  );

  const allMatches = [
    ...bracket.groups.flatMap((g) => g.matches),
    ...bracket.knockout.flatMap((k) => k.matches),
  ];
  for (const match of allMatches) {
    for (const id of [match.homeId, match.awayId]) {
      if (!userSet.has(id)) continue;
      const outcome = outcomes.get(id)!;
      if (match.winnerId === id) {
        outcome.wins++;
        outcome.xp += 15;
      } else {
        outcome.losses++;
        outcome.xp += 5;
      }
    }
  }

  const userWon = userSet.has(bracket.championId);
  if (userWon) {
    const champion = outcomes.get(bracket.championId)!;
    champion.trophies += 1;
    champion.xp += 150;
    champion.becameMvp = true;
  }
  if (userSet.has(bracket.runnerUpId)) {
    outcomes.get(bracket.runnerUpId)!.xp += 60;
  }

  const cardOutcomes = [...outcomes.values()];
  const userXp = 50 + cardOutcomes.reduce((s, c) => s + c.xp, 0);
  const userCurrency = 100 + (userWon ? 200 : 0);
  return { userXp, userCurrency, userWon, cardOutcomes };
}

export function levelForXp(xp: number): number {
  return 1 + Math.floor(Math.sqrt(xp / 100));
}
