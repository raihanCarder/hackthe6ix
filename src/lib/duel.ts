import "server-only";
import type { Duel, Prisma, User } from "@/generated/prisma/client";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { createRng } from "@/lib/engine/seed";
import { computeCardStats, type CardStats } from "@/lib/game/cardStats";
import { computeDuelRewards, resolveRoundWinner, type DuelRound } from "@/lib/game/duelRewards";
import { levelForXp } from "@/lib/game/rewards";
import { ApiError, asJson } from "@/lib/api/core";
import { broadcastDuelChange } from "@/lib/supabase/serverBroadcast";
import { prisma } from "@/lib/db";

const SQUAD_SIZE = 3;
const ROUNDS_TO_WIN = 2; // best-of-3

/**
 * Waiting-room matchmaking + turn-based, best-of-3 stat-call duel
 * (documentation/ideas/IDEA.md "3-card squad quick-match"). Server-authoritative:
 * every state transition is a Duel row write, followed by a best-effort
 * realtime ping (src/lib/supabase/serverBroadcast.ts) so both clients refetch.
 */

export async function startOrJoinDuel(
  user: User,
  cardIds: string[],
): Promise<{ duelId: string; matched: boolean }> {
  await assertOwnsSquad(user.id, cardIds);

  const existing = await prisma.duel.findFirst({
    where: { player1Id: user.id, status: "waiting" },
  });
  if (existing) return { duelId: existing.id, matched: false };

  const { duel, matched } = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; player1Id: string }[]>`
      SELECT id, "player1Id" FROM "Duel"
      WHERE status = 'waiting' AND "player1Id" != ${user.id}
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    const waiting = rows[0];

    if (waiting) {
      const joined = await tx.duel.update({
        where: { id: waiting.id },
        data: {
          player2Id: user.id,
          player2CardIds: asJson(cardIds),
          status: "active",
          turnPlayerId: waiting.player1Id,
        },
      });
      return { duel: joined, matched: true };
    }

    const created = await tx.duel.create({
      data: { status: "waiting", player1Id: user.id, player1CardIds: asJson(cardIds) },
    });
    return { duel: created, matched: false };
  });

  if (matched) await broadcastDuelChange(duel.id);
  return { duelId: duel.id, matched };
}

export async function cancelWaitingDuel(user: User, duelId: string): Promise<void> {
  const result = await prisma.duel.deleteMany({
    where: { id: duelId, player1Id: user.id, status: "waiting" },
  });
  if (result.count === 0) throw new ApiError(404, "Waiting match not found");
}

export async function requireDuelParticipant(user: User, duelId: string): Promise<Duel> {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  if (!duel) throw new ApiError(404, "Duel not found");
  if (duel.player1Id !== user.id && duel.player2Id !== user.id) {
    throw new ApiError(403, "Not a participant in this duel");
  }
  return duel;
}

export async function callStat(user: User, duelId: string, stat: keyof CardStats): Promise<void> {
  const duel = await requireDuelParticipant(user, duelId);
  if (duel.status !== "active") throw new ApiError(422, "This duel isn't active");
  if (duel.turnPlayerId !== user.id) throw new ApiError(403, "It's not your turn to call");
  if (!duel.player2Id || !duel.player2CardIds) {
    throw new ApiError(422, "This duel is missing an opponent");
  }

  const rounds = ((duel.rounds as unknown as DuelRound[]) ?? []).slice();
  const player1CardIds = duel.player1CardIds as unknown as string[];
  const player2CardIds = duel.player2CardIds as unknown as string[];
  const roundIndex = rounds.length;
  if (roundIndex >= player1CardIds.length) throw new ApiError(422, "This duel has already finished");

  const player1CardId = player1CardIds[roundIndex];
  const player2CardId = player2CardIds[roundIndex];

  const [card1, card2] = await Promise.all([
    prisma.savedCard.findUnique({ where: { id: player1CardId }, include: { snapshot: true } }),
    prisma.savedCard.findUnique({ where: { id: player2CardId }, include: { snapshot: true } }),
  ]);
  if (!card1 || !card2) throw new ApiError(500, "A squad card could not be loaded");

  const value1 = computeCardStats(
    card1.snapshot.normalizedData as unknown as NormalizedAccommodation,
    null,
  )[stat];
  const value2 = computeCardStats(
    card2.snapshot.normalizedData as unknown as NormalizedAccommodation,
    null,
  )[stat];

  const { winnerId, tieBroken } = resolveRoundWinner(
    value1,
    value2,
    duel.player1Id,
    duel.player2Id,
    createRng(`duel:${duel.id}:${roundIndex}`)(),
  );

  const round: DuelRound = {
    round: roundIndex,
    callerId: user.id,
    stat,
    player1CardId,
    player2CardId,
    player1Value: value1,
    player2Value: value2,
    winnerId,
    tieBroken,
  };
  rounds.push(round);

  const player1Wins = duel.player1Wins + (winnerId === duel.player1Id ? 1 : 0);
  const player2Wins = duel.player2Wins + (winnerId === duel.player2Id ? 1 : 0);
  const finalWinnerId =
    player1Wins >= ROUNDS_TO_WIN
      ? duel.player1Id
      : player2Wins >= ROUNDS_TO_WIN
        ? duel.player2Id
        : null;
  const isComplete = finalWinnerId !== null || rounds.length >= player1CardIds.length;
  const winnerIdForRewards = finalWinnerId ?? (player1Wins > player2Wins ? duel.player1Id : duel.player2Id);
  const nextTurnPlayerId = duel.turnPlayerId === duel.player1Id ? duel.player2Id : duel.player1Id;

  await prisma.$transaction(async (tx) => {
    await tx.duel.update({
      where: { id: duel.id },
      data: {
        rounds: asJson(rounds),
        player1Wins,
        player2Wins,
        turnPlayerId: isComplete ? null : nextTurnPlayerId,
        status: isComplete ? "complete" : "active",
        winnerId: isComplete ? winnerIdForRewards : null,
      },
    });

    if (isComplete) {
      await applyDuelRewards(tx, {
        player1Id: duel.player1Id,
        player2Id: duel.player2Id!,
        player1CardIds,
        player2CardIds,
        rounds,
        winnerId: winnerIdForRewards,
      });
    }
  });

  await broadcastDuelChange(duel.id);
}

async function assertOwnsSquad(userId: string, cardIds: string[]): Promise<void> {
  if (cardIds.length !== SQUAD_SIZE || new Set(cardIds).size !== SQUAD_SIZE) {
    throw new ApiError(422, `Pick exactly ${SQUAD_SIZE} different cards for your squad`);
  }
  const owned = await prisma.savedCard.count({ where: { userId, id: { in: cardIds } } });
  if (owned !== SQUAD_SIZE) throw new ApiError(404, "One or more cards not found in your collection");
}

async function applyDuelRewards(
  tx: Prisma.TransactionClient,
  args: {
    player1Id: string;
    player2Id: string;
    player1CardIds: string[];
    player2CardIds: string[];
    rounds: DuelRound[];
    winnerId: string;
  },
): Promise<void> {
  const { player1Id, player2Id, player1CardIds, player2CardIds, rounds, winnerId } = args;
  const [user1, user2] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: player1Id } }),
    tx.user.findUniqueOrThrow({ where: { id: player2Id } }),
  ]);

  const entries = [
    { user: user1, rewards: computeDuelRewards(rounds, winnerId, player1Id, true, player1CardIds) },
    { user: user2, rewards: computeDuelRewards(rounds, winnerId, player2Id, false, player2CardIds) },
  ];

  for (const { user, rewards } of entries) {
    const newXp = user.xp + rewards.userXp;
    await tx.user.update({
      where: { id: user.id },
      data: {
        xp: newXp,
        level: levelForXp(newXp),
        currency: { increment: rewards.userCurrency },
        matchesPlayed: { increment: 1 },
        wins: { increment: rewards.userWon ? 1 : 0 },
        losses: { increment: rewards.userWon ? 0 : 1 },
        currentWinStreak: rewards.userWon ? user.currentWinStreak + 1 : 0,
        bestWinStreak: rewards.userWon
          ? Math.max(user.bestWinStreak, user.currentWinStreak + 1)
          : user.bestWinStreak,
        mvpCount: { increment: rewards.userWon ? 1 : 0 },
      },
    });
    for (const outcome of rewards.cardOutcomes) {
      await tx.savedCard.update({
        where: { id: outcome.cardId },
        data: {
          wins: { increment: outcome.wins },
          losses: { increment: outcome.losses },
          xp: { increment: outcome.xp },
        },
      });
    }
  }
}
