import "server-only";
import type { KaraokeDuel, User } from "@/generated/prisma/client";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { createRng } from "@/lib/engine/seed";
import { ApiError, asJson } from "@/lib/api/core";
import { prisma } from "@/lib/db";
import { generateKaraokeLyrics, type KaraokeSong } from "./lyrics";
import { prepareKaraokeSongAudio } from "./audio.server";
import { applyKaraokeRewards } from "./rewards";

/**
 * Bonus karaoke duel, unlocked only after finishing a PvP card Duel against
 * the same opponent. Both players are known immediately from the source
 * Duel — no open matchmaking — then each picks their own hotel to sing
 * about, and ElevenLabs Music writes the songs. Clients poll the same way
 * src/lib/duel.ts does; ensureKaraokeReady runs the generation pipeline once
 * both cards are in. There's no AI judge — each client measures its own
 * player's sing-along loudness through the mic and submits a score
 * (submitKaraokeLoudnessScore); loudest performer wins.
 */

export async function startBonusKaraokeDuel(user: User, sourceDuelId: string): Promise<{ duelId: string }> {
  const sourceDuel = await prisma.duel.findUnique({ where: { id: sourceDuelId } });
  if (!sourceDuel || sourceDuel.status !== "complete") {
    throw new ApiError(422, "Finish a PvP duel first to unlock the bonus karaoke round");
  }
  if (sourceDuel.player1Id !== user.id && sourceDuel.player2Id !== user.id) {
    throw new ApiError(403, "Not a participant in that duel");
  }
  if (!sourceDuel.player2Id) throw new ApiError(422, "That duel has no opponent to challenge");

  // Both players are already fixed by the source duel, so this is a plain
  // find-or-create keyed on sourceDuelId — no race to resolve, since neither
  // caller can change who the two participants are. Whoever's call actually
  // creates the row is the inviter; the other participant must accept.
  const duel = await prisma.karaokeDuel.upsert({
    where: { sourceDuelId },
    create: {
      status: "pending",
      sourceDuelId,
      invitedById: user.id,
      player1Id: sourceDuel.player1Id,
      player2Id: sourceDuel.player2Id,
    },
    update: {},
  });

  return { duelId: duel.id };
}

/**
 * Read-only lookup so a source Duel's room can poll for a karaoke challenge
 * without creating one — startBonusKaraokeDuel's upsert is only safe to call
 * from an explicit user action, not from a poll.
 */
export async function findKaraokeDuelBySource(
  sourceDuelId: string,
): Promise<{ id: string; status: string; invitedById: string } | null> {
  const duel = await prisma.karaokeDuel.findUnique({
    where: { sourceDuelId },
    select: { id: true, status: true, invitedById: true },
  });
  return duel;
}

export async function requireKaraokeParticipant(user: User, duelId: string): Promise<KaraokeDuel> {
  const duel = await prisma.karaokeDuel.findUnique({ where: { id: duelId } });
  if (!duel) throw new ApiError(404, "Karaoke duel not found");
  if (duel.player1Id !== user.id && duel.player2Id !== user.id) {
    throw new ApiError(403, "Not a participant in this karaoke duel");
  }
  return duel;
}

export async function respondToKaraokeInvite(user: User, duelId: string, accept: boolean): Promise<void> {
  const duel = await requireKaraokeParticipant(user, duelId);
  if (duel.status !== "pending") throw new ApiError(422, "This invite has already been resolved");
  if (duel.invitedById === user.id) throw new ApiError(403, "Waiting for the other player to respond");

  await prisma.karaokeDuel.updateMany({
    where: { id: duelId, status: "pending" },
    data: { status: accept ? "picking" : "declined" },
  });
}

export async function pickKaraokeCard(user: User, duelId: string, cardId: string): Promise<void> {
  const duel = await requireKaraokeParticipant(user, duelId);
  if (duel.status !== "picking") throw new ApiError(422, "Songs are already underway for this duel");
  await assertOwnsCard(user.id, cardId);

  const isPlayer1 = duel.player1Id === user.id;
  await prisma.karaokeDuel.updateMany({
    where: {
      id: duelId,
      ...(isPlayer1 ? { player1CardId: null } : { player2CardId: null }),
    },
    data: isPlayer1 ? { player1CardId: cardId } : { player2CardId: cardId },
  });
}

/**
 * Runs the whole generation pipeline once both players have picked a hotel.
 * Only the request that wins the atomic "picking" -> "generating" claim does
 * the work; everyone else's poll just returns the current row. On any
 * failure the claim is released back to "picking" so the next poll can retry.
 */
export async function ensureKaraokeReady(duelId: string): Promise<void> {
  const duel = await prisma.karaokeDuel.findUnique({ where: { id: duelId } });
  if (!duel || duel.status !== "picking" || !duel.player1CardId || !duel.player2CardId) return;

  const claimed = await prisma.karaokeDuel.updateMany({
    where: { id: duelId, status: "picking", player1CardId: { not: null }, player2CardId: { not: null } },
    data: { status: "generating" },
  });
  if (claimed.count !== 1) return;

  try {
    const [card1, card2] = await Promise.all([
      prisma.savedCard.findUniqueOrThrow({ where: { id: duel.player1CardId }, include: { snapshot: true } }),
      prisma.savedCard.findUniqueOrThrow({ where: { id: duel.player2CardId }, include: { snapshot: true } }),
    ]);
    const hotel1 = card1.snapshot.normalizedData as unknown as NormalizedAccommodation;
    const hotel2 = card2.snapshot.normalizedData as unknown as NormalizedAccommodation;

    const [song1, song2] = await Promise.all([
      generateKaraokeLyrics(hotel1),
      generateKaraokeLyrics(hotel2),
    ]);
    const [audio1, audio2] = await Promise.all([
      prepareKaraokeSongAudio(buildSongPrompt(hotel1, song1)),
      prepareKaraokeSongAudio(buildSongPrompt(hotel2, song2)),
    ]);

    await prisma.karaokeDuel.update({
      where: { id: duelId },
      data: {
        status: "judging",
        player1Lyrics: formatLyrics(song1),
        player2Lyrics: formatLyrics(song2),
        player1AudioCacheKey: audio1.status === "ready" ? audio1.cacheKey : null,
        player2AudioCacheKey: audio2.status === "ready" ? audio2.cacheKey : null,
      },
    });
  } catch (error) {
    console.error("Karaoke duel generation pipeline failed; reopening for retry", error);
    await prisma.karaokeDuel.update({ where: { id: duelId }, data: { status: "picking" } });
  }
}

/**
 * Records one player's mic-measured sing-along loudness (0-100, computed
 * client-side — see KaraokeRoomClient). Once both scores are in, the louder
 * performer wins; an exact tie is broken by the same seeded-RNG discipline
 * as resolveRoundWinner in src/lib/game/duelRewards.ts.
 */
export async function submitKaraokeLoudnessScore(user: User, duelId: string, score: number): Promise<void> {
  const duel = await requireKaraokeParticipant(user, duelId);
  if (duel.status !== "judging") throw new ApiError(422, "This duel isn't ready to be scored yet");

  const isPlayer1 = duel.player1Id === user.id;
  await prisma.karaokeDuel.updateMany({
    where: {
      id: duelId,
      ...(isPlayer1 ? { player1LoudnessScore: null } : { player2LoudnessScore: null }),
    },
    data: isPlayer1 ? { player1LoudnessScore: score } : { player2LoudnessScore: score },
  });

  await finalizeIfBothScored(duelId);
}

async function finalizeIfBothScored(duelId: string): Promise<void> {
  const claimed = await prisma.karaokeDuel.updateMany({
    where: {
      id: duelId,
      status: "judging",
      player1LoudnessScore: { not: null },
      player2LoudnessScore: { not: null },
    },
    data: { status: "complete" },
  });
  if (claimed.count !== 1) return;

  const duel = await prisma.karaokeDuel.findUniqueOrThrow({ where: { id: duelId } });
  const player1Score = duel.player1LoudnessScore ?? 0;
  const player2Score = duel.player2LoudnessScore ?? 0;
  const tieBroken = player1Score === player2Score;
  const player1Wins = tieBroken
    ? createRng(`karaoke-loudness:${duelId}`)() < 0.5
    : player1Score > player2Score;
  const winnerId = player1Wins ? duel.player1Id : duel.player2Id;
  const loserId = player1Wins ? duel.player2Id : duel.player1Id;
  const [winner, loser] = await Promise.all([
    prisma.user.findUnique({ where: { id: winnerId }, select: { username: true } }),
    prisma.user.findUnique({ where: { id: loserId }, select: { username: true } }),
  ]);
  const reasoning = tieBroken
    ? `${winner?.username ?? "One singer"} and ${loser?.username ?? "the other"} tied on volume — the coin flip gave it to ${winner?.username ?? "the winner"}!`
    : `${winner?.username ?? "The winner"} sang it loudest and takes the bonus round!`;

  await prisma.$transaction(async (tx) => {
    await tx.karaokeDuel.update({
      where: { id: duelId },
      data: {
        winnerId,
        verdict: asJson({ player1Score, player2Score, reasoning }),
      },
    });
    await applyKaraokeRewards(tx, { winnerId, loserId });
  });
}

function buildSongPrompt(hotel: NormalizedAccommodation, song: KaraokeSong): string {
  const place = [hotel.name, hotel.countryName].filter(Boolean).join(", ");
  return [
    `Short chorus-only singalong bar song hook titled "${song.title}" hyping up a hotel stay at ${place || "a hotel"}.`,
    "Crowd of friends banging mugs on the table, chanting along — acoustic guitar and piano, warm pub-singalong energy, catty and sassy but fun, not aggressive. Just the hook, no verse.",
    "Lyrics:",
    song.lyrics,
  ].join("\n");
}

function formatLyrics(song: KaraokeSong): string {
  return `${song.title}\n\n${song.lyrics}`;
}

async function assertOwnsCard(userId: string, cardId: string): Promise<void> {
  const owned = await prisma.savedCard.count({ where: { userId, id: cardId } });
  if (owned !== 1) throw new ApiError(404, "Card not found in your collection");
}
