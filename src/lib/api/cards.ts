import "server-only";
import { z } from "zod";
import type { Rarity } from "@/lib/game/cardStats";
import type { User } from "@/generated/prisma/client";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import {
  cardSellValue,
  collectibleOverallRating,
  computeCardStats,
} from "@/lib/game/cardStats";
import { rehydrateProperty } from "@/lib/stay22/client";
import { prisma } from "@/lib/db";
import { ApiError, PACK_COST } from "./core";

export async function getUserCollection(user: User) {
  const cards = await prisma.savedCard.findMany({
    where: { userId: user.id },
    include: { snapshot: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    cards: cards.map((card) => {
      const hotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
      const stats = computeCardStats(hotel, null);
      return {
        id: card.id,
        propertyId: card.stay22PropertyId,
        rarity: card.rarity,
        cosmeticSeed: card.cosmeticSeed,
        acquiredCity: card.acquiredCity,
        acquiredScope: card.acquiredScope,
        sourceApiCallId: card.snapshot.sourceApiCallId,
        xp: card.xp,
        trophies: card.trophies,
        wins: card.wins,
        losses: card.losses,
        timesMvp: card.timesMvp,
        dateAcquired: card.dateAcquired,
        stats,
        overall: collectibleOverallRating(stats, card.rarity),
        hotel,
      };
    }),
  };
}

export const sellCardsSchema = z.object({
  cardIds: z.array(z.string().min(1)).min(1),
});

export async function sellCards(user: User, cardIds: string[]) {
  const ids = [...new Set(cardIds)];
  const cards = await prisma.savedCard.findMany({
    where: { id: { in: ids }, userId: user.id },
    include: { snapshot: true },
  });
  if (cards.length !== ids.length) {
    throw new ApiError(404, "Some cards were not found");
  }

  const coinsEarned = cards.reduce((sum, card) => {
    const hotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
    const stats = computeCardStats(hotel, null);
    const overall = collectibleOverallRating(stats, card.rarity);
    return sum + cardSellValue(card.rarity as Rarity, overall);
  }, 0);

  // Prevent a soft-lock: don't let the user empty their collection into a
  // balance that can't even afford a pack. They must keep at least one card,
  // or hold enough coins to buy their way back in.
  const totalCards = await prisma.savedCard.count({ where: { userId: user.id } });
  const remainingCards = totalCards - cards.length;
  const projectedBalance = user.currency + coinsEarned;
  if (remainingCards === 0 && projectedBalance < PACK_COST) {
    throw new ApiError(
      422,
      `Selling every card would leave you with ${projectedBalance} coins — short of the ${PACK_COST} a pack costs. Keep at least one card.`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.savedCard.deleteMany({ where: { id: { in: ids }, userId: user.id } });
    return tx.user.update({
      where: { id: user.id },
      data: { currency: { increment: coinsEarned } },
    });
  });

  return { soldCount: cards.length, coinsEarned, newBalance: updated.currency };
}

export async function rehydrateSavedCard(user: User, cardId: string) {
  const card = await prisma.savedCard.findFirst({
    where: { id: cardId, userId: user.id },
    include: { snapshot: { include: { sourceApiCall: true } } },
  });
  if (!card) throw new ApiError(404, "Card not found");

  const params = card.snapshot.sourceApiCall.requestParams as Record<string, unknown>;
  const live = await rehydrateProperty(card.stay22PropertyId, {
    address: String(params.address),
    checkin: String(params.checkin),
    checkout: String(params.checkout),
    adults: Number(params.adults),
    children: Number(params.children),
    rooms: Number(params.rooms),
    currency: String(params.currency ?? "CAD"),
  });

  if (!live) return { available: false, status: "TRANSFER_PENDING" };
  return { available: true, hotel: live };
}
