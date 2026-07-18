import { NextResponse } from "next/server";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { computeCardStats, overallRating } from "@/lib/game/cardStats";
import { handleApiError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

/** The user's collection, rendered from stored snapshots (no live calls). */
export async function GET() {
  try {
    const user = await requireUser();
    const cards = await prisma.savedCard.findMany({
      where: { userId: user.id },
      include: { snapshot: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
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
    });
  } catch (error) {
    return handleApiError(error);
  }
}
