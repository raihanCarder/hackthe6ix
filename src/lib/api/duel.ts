import "server-only";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { computeCardStats, overallRating } from "@/lib/game/cardStats";
import { computeDuelRewards, type DuelRound } from "@/lib/game/duelRewards";
import { callStat, cancelWaitingDuel, requireDuelParticipant, startOrJoinDuel } from "@/lib/duel";
import { prisma } from "@/lib/db";

export const startDuelSchema = z.object({
  cardIds: z.array(z.string().min(1)).length(3),
});

export const callStatSchema = z.object({
  stat: z.enum(["comfort", "amenities", "luxury", "value", "location", "service"]),
});

export async function startDuel(
  user: User,
  body: z.infer<typeof startDuelSchema>,
): Promise<{ duelId: string; matched: boolean }> {
  return startOrJoinDuel(user, body.cardIds);
}

export async function cancelDuel(user: User, duelId: string): Promise<{ ok: true }> {
  await cancelWaitingDuel(user, duelId);
  return { ok: true };
}

export async function callDuelStat(
  user: User,
  duelId: string,
  body: z.infer<typeof callStatSchema>,
) {
  await callStat(user, duelId, body.stat);
  return getDuelView(user, duelId);
}

/**
 * Client-facing duel state. Enforces hidden information server-side: an
 * opponent's un-played squad cards are simply never included in the response.
 */
export async function getDuelView(user: User, duelId: string) {
  const duel = await requireDuelParticipant(user, duelId);
  const isPlayer1 = duel.player1Id === user.id;
  const opponentId = isPlayer1 ? duel.player2Id : duel.player1Id;

  const rounds = (duel.rounds as unknown as DuelRound[]) ?? [];
  const myCardIds = (isPlayer1 ? duel.player1CardIds : duel.player2CardIds) as string[] | null;
  const opponentCardIds = (isPlayer1 ? duel.player2CardIds : duel.player1CardIds) as
    | string[]
    | null;

  const revealedOpponentCardIds = new Set(
    rounds.map((round) => (isPlayer1 ? round.player2CardId : round.player1CardId)),
  );
  const visibleCardIds = [
    ...(myCardIds ?? []),
    ...(opponentCardIds ?? []).filter((id) => revealedOpponentCardIds.has(id)),
  ];

  const savedCards = visibleCardIds.length
    ? await prisma.savedCard.findMany({
        where: { id: { in: visibleCardIds } },
        include: { snapshot: true },
      })
    : [];

  const cards = Object.fromEntries(
    savedCards.map((card) => {
      const hotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
      const stats = computeCardStats(hotel, null);
      return [
        card.id,
        {
          id: card.id,
          hotel,
          stats,
          overall: overallRating(stats),
          rarity: card.rarity,
          cosmeticSeed: card.cosmeticSeed,
        },
      ];
    }),
  );

  const [player1, player2] = await Promise.all([
    prisma.user.findUnique({ where: { id: duel.player1Id }, select: { username: true } }),
    duel.player2Id
      ? prisma.user.findUnique({ where: { id: duel.player2Id }, select: { username: true } })
      : Promise.resolve(null),
  ]);

  const rewards =
    duel.status === "complete" && duel.winnerId
      ? computeDuelRewards(rounds, duel.winnerId, user.id, isPlayer1, myCardIds ?? [])
      : null;

  return {
    id: duel.id,
    status: duel.status,
    isPlayer1,
    myUsername: isPlayer1 ? player1?.username : player2?.username,
    opponent: opponentId
      ? { id: opponentId, username: isPlayer1 ? player2?.username : player1?.username }
      : null,
    myCardIds: myCardIds ?? [],
    opponentCardCount: opponentCardIds?.length ?? 3,
    isMyTurn: duel.turnPlayerId === user.id,
    myWins: isPlayer1 ? duel.player1Wins : duel.player2Wins,
    opponentWins: isPlayer1 ? duel.player2Wins : duel.player1Wins,
    winnerId: duel.winnerId,
    iWon: duel.winnerId ? duel.winnerId === user.id : null,
    rounds: rounds.map((round) => ({
      round: round.round,
      stat: round.stat,
      myValue: isPlayer1 ? round.player1Value : round.player2Value,
      opponentValue: isPlayer1 ? round.player2Value : round.player1Value,
      myCardId: isPlayer1 ? round.player1CardId : round.player2CardId,
      opponentCardId: isPlayer1 ? round.player2CardId : round.player1CardId,
      iWon: round.winnerId === user.id,
      tieBroken: round.tieBroken,
    })),
    cards,
    rewards,
  };
}
