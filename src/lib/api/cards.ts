import "server-only";
import type { User } from "@/generated/prisma/client";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { computeCardStats, overallRating } from "@/lib/game/cardStats";
import { rehydrateProperty } from "@/lib/stay22/client";
import { prisma } from "@/lib/db";
import { ApiError } from "./core";

export async function getUserCollection(user: User) {
  const cards = await prisma.savedCard.findMany({
    where: { userId: user.id },
    include: { snapshot: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    cards: cards.map((card) => {
      const hotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
      const stats = computeCardStats(hotel, null, card.cosmeticSeed);
      return {
        id: card.id,
        propertyId: card.stay22PropertyId,
        rarity: card.rarity,
        cosmeticSeed: card.cosmeticSeed,
        acquiredCity: card.acquiredCity,
        xp: card.xp,
        trophies: card.trophies,
        wins: card.wins,
        losses: card.losses,
        timesMvp: card.timesMvp,
        dateAcquired: card.dateAcquired,
        stats,
        overall: overallRating(stats),
        hotel,
      };
    }),
  };
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
