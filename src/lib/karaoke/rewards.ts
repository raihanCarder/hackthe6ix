import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { levelForXp } from "@/lib/game/rewards";

/**
 * Flat, non-card-affecting rewards for the karaoke bonus mode — deliberately
 * simpler than computeDuelRewards (src/lib/game/duelRewards.ts), which scales
 * with per-round card stats that don't exist here.
 */
const WINNER_XP = 50;
const WINNER_CURRENCY = 25;
const LOSER_XP = 10;
const LOSER_CURRENCY = 0;

export interface KaraokeRewards {
  winnerXp: number;
  winnerCurrency: number;
  loserXp: number;
  loserCurrency: number;
}

export function computeKaraokeRewards(): KaraokeRewards {
  return {
    winnerXp: WINNER_XP,
    winnerCurrency: WINNER_CURRENCY,
    loserXp: LOSER_XP,
    loserCurrency: LOSER_CURRENCY,
  };
}

export async function applyKaraokeRewards(
  tx: Prisma.TransactionClient,
  args: { winnerId: string; loserId: string },
): Promise<void> {
  const rewards = computeKaraokeRewards();
  const [winner, loser] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: args.winnerId } }),
    tx.user.findUniqueOrThrow({ where: { id: args.loserId } }),
  ]);

  const winnerXp = winner.xp + rewards.winnerXp;
  await tx.user.update({
    where: { id: winner.id },
    data: {
      xp: winnerXp,
      level: levelForXp(winnerXp),
      currency: { increment: rewards.winnerCurrency },
    },
  });

  const loserXp = loser.xp + rewards.loserXp;
  await tx.user.update({
    where: { id: loser.id },
    data: {
      xp: loserXp,
      level: levelForXp(loserXp),
      currency: { increment: rewards.loserCurrency },
    },
  });
}
