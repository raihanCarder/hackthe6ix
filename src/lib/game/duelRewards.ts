import type { CardStats } from "./cardStats";

/** One resolved best-of-3 stat-call round (documentation/ideas/IDEA.md "3-card squad quick-match"). */
export interface DuelRound {
  round: number;
  callerId: string;
  stat: keyof CardStats;
  player1CardId: string;
  player2CardId: string;
  player1Value: number;
  player2Value: number;
  winnerId: string;
  tieBroken: boolean;
}

export interface DuelCardOutcome {
  cardId: string;
  wins: number;
  losses: number;
  xp: number;
}

export interface DuelRewards {
  userXp: number;
  userCurrency: number;
  userWon: boolean;
  cardOutcomes: DuelCardOutcome[];
}

export interface RoundOutcome {
  winnerId: string;
  tieBroken: boolean;
}

/**
 * Decides one round: higher stat value wins; an exact tie is broken by a
 * caller-supplied random draw in [0, 1) (the caller seeds this deterministically,
 * e.g. createRng(`duel:${id}:${round}`)(), so replays stay reproducible).
 */
export function resolveRoundWinner(
  value1: number,
  value2: number,
  player1Id: string,
  player2Id: string,
  tieBreakRandom: number,
): RoundOutcome {
  if (value1 > value2) return { winnerId: player1Id, tieBroken: false };
  if (value2 > value1) return { winnerId: player2Id, tieBroken: false };
  return { winnerId: tieBreakRandom < 0.5 ? player1Id : player2Id, tieBroken: true };
}

const ROUND_WIN_CARD_XP = 20;
const ROUND_LOSS_CARD_XP = 5;
const DUEL_WIN_BASE_XP = 80;
const DUEL_LOSS_BASE_XP = 25;
const DUEL_WIN_CURRENCY = 150;
const DUEL_LOSS_CURRENCY = 30;

/**
 * Post-duel progression, scaled down from computeTournamentRewards (rewards.ts)
 * for a quick best-of-3 match. Rewards are flavor — they never affect who wins
 * a duel, which is decided purely by the stat calls already resolved in `rounds`.
 */
export function computeDuelRewards(
  rounds: DuelRound[],
  winnerId: string,
  userId: string,
  isPlayer1: boolean,
  userCardIds: string[],
): DuelRewards {
  const userWon = winnerId === userId;
  const outcomes = new Map<string, DuelCardOutcome>(
    userCardIds.map((id) => [id, { cardId: id, wins: 0, losses: 0, xp: 0 }]),
  );

  for (const round of rounds) {
    const userCardId = isPlayer1 ? round.player1CardId : round.player2CardId;
    const outcome = outcomes.get(userCardId);
    if (!outcome) continue;
    if (round.winnerId === userId) {
      outcome.wins++;
      outcome.xp += ROUND_WIN_CARD_XP;
    } else {
      outcome.losses++;
      outcome.xp += ROUND_LOSS_CARD_XP;
    }
  }

  const cardOutcomes = [...outcomes.values()];
  const userXp =
    (userWon ? DUEL_WIN_BASE_XP : DUEL_LOSS_BASE_XP) +
    cardOutcomes.reduce((sum, c) => sum + c.xp, 0);
  const userCurrency = userWon ? DUEL_WIN_CURRENCY : DUEL_LOSS_CURRENCY;

  return { userXp, userCurrency, userWon, cardOutcomes };
}
