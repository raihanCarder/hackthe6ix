import "server-only";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { computeCardStats, overallRating } from "@/lib/game/cardStats";
import { computeKaraokeRewards } from "@/lib/karaoke/rewards";
import {
  ensureKaraokeReady,
  pickKaraokeCard,
  requireKaraokeParticipant,
  respondToKaraokeInvite,
  startBonusKaraokeDuel,
  submitKaraokeLoudnessScore,
} from "@/lib/karaoke/duel";
import { prisma } from "@/lib/db";

export const startKaraokeDuelSchema = z.object({
  sourceDuelId: z.string().min(1),
});

export const respondToKaraokeInviteSchema = z.object({
  accept: z.boolean(),
});

export const pickKaraokeCardSchema = z.object({
  cardId: z.string().min(1),
});

export const submitKaraokeScoreSchema = z.object({
  score: z.number().min(0).max(100),
});

export async function startKaraokeDuel(
  user: User,
  body: z.infer<typeof startKaraokeDuelSchema>,
): Promise<{ duelId: string }> {
  return startBonusKaraokeDuel(user, body.sourceDuelId);
}

export async function respondToKaraokeSongInvite(
  user: User,
  duelId: string,
  body: z.infer<typeof respondToKaraokeInviteSchema>,
) {
  await respondToKaraokeInvite(user, duelId, body.accept);
  return getKaraokeDuelView(user, duelId);
}

export async function pickKaraokeSongCard(
  user: User,
  duelId: string,
  body: z.infer<typeof pickKaraokeCardSchema>,
) {
  await pickKaraokeCard(user, duelId, body.cardId);
  return getKaraokeDuelView(user, duelId);
}

export async function submitKaraokeSongScore(
  user: User,
  duelId: string,
  body: z.infer<typeof submitKaraokeScoreSchema>,
) {
  await submitKaraokeLoudnessScore(user, duelId, body.score);
  return getKaraokeDuelView(user, duelId);
}

/**
 * Client-facing karaoke duel state. Unlike the stat-call Duel, there's no
 * hidden information to withhold — both hotels are visible once picked.
 */
export async function getKaraokeDuelView(user: User, duelId: string) {
  await ensureKaraokeReady(duelId);
  const duel = await requireKaraokeParticipant(user, duelId);
  const isPlayer1 = duel.player1Id === user.id;
  const opponentId = isPlayer1 ? duel.player2Id : duel.player1Id;

  const cardIds = [duel.player1CardId, duel.player2CardId].filter((id): id is string => Boolean(id));
  const savedCards = cardIds.length
    ? await prisma.savedCard.findMany({ where: { id: { in: cardIds } }, include: { snapshot: true } })
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
    prisma.user.findUnique({ where: { id: duel.player2Id }, select: { username: true } }),
  ]);

  const verdict = duel.verdict as { player1Score: number; player2Score: number; reasoning: string } | null;
  const iWon = duel.winnerId ? duel.winnerId === user.id : null;
  const rewards =
    duel.status === "complete" && duel.winnerId
      ? (() => {
          const flat = computeKaraokeRewards();
          return iWon
            ? { xp: flat.winnerXp, currency: flat.winnerCurrency, won: true }
            : { xp: flat.loserXp, currency: flat.loserCurrency, won: false };
        })()
      : null;

  return {
    id: duel.id,
    status: duel.status,
    isPlayer1,
    invitedByMe: duel.invitedById === user.id,
    myUsername: isPlayer1 ? player1?.username : player2?.username,
    opponent: { id: opponentId, username: isPlayer1 ? player2?.username : player1?.username },
    myCardId: isPlayer1 ? duel.player1CardId : duel.player2CardId,
    opponentCardId: isPlayer1 ? duel.player2CardId : duel.player1CardId,
    myLyrics: isPlayer1 ? duel.player1Lyrics : duel.player2Lyrics,
    opponentLyrics: isPlayer1 ? duel.player2Lyrics : duel.player1Lyrics,
    myAudioCacheKey: isPlayer1 ? duel.player1AudioCacheKey : duel.player2AudioCacheKey,
    opponentAudioCacheKey: isPlayer1 ? duel.player2AudioCacheKey : duel.player1AudioCacheKey,
    myScore: verdict ? (isPlayer1 ? verdict.player1Score : verdict.player2Score) : null,
    opponentScore: verdict ? (isPlayer1 ? verdict.player2Score : verdict.player1Score) : null,
    reasoning: verdict?.reasoning ?? null,
    winnerId: duel.winnerId,
    iWon,
    cards,
    rewards,
  };
}
