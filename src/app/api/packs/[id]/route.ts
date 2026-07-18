import { NextResponse, type NextRequest } from "next/server";
import { applyHardConstraints } from "@/lib/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/types";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { computeCardStats, overallRating, poolPriceContext } from "@/lib/game/cardStats";
import { ApiError, handleApiError, loadSearch, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

/** Replay a pack opening (used by the reveal screen and history). */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const pack = await prisma.packOpen.findFirst({ where: { id, userId: user.id } });
    if (!pack) throw new ApiError(404, "Pack not found");

    const cardIds = pack.generatedCardIds as unknown as string[];
    const cards = await prisma.savedCard.findMany({
      where: { id: { in: cardIds } },
      include: { snapshot: true },
    });
    const byId = new Map(cards.map((c) => [c.id, c]));

    const search = await loadSearch(pack.searchApiCallId, user.id);
    const { eligible } = applyHardConstraints(search.pool, search.trip, DEFAULT_ENGINE_CONFIG);
    const prices = poolPriceContext(eligible);

    return NextResponse.json({
      packId: pack.id,
      searchId: pack.searchApiCallId,
      city: pack.city,
      cost: pack.cost,
      seed: pack.seed,
      trip: search.trip,
      cards: cardIds
        .map((cardId) => byId.get(cardId))
        .filter((c) => c !== undefined)
        .map((card) => {
          const hotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
          const stats = computeCardStats(hotel, prices, card.cosmeticSeed);
          return {
            id: card.id,
            propertyId: card.stay22PropertyId,
            rarity: card.rarity,
            cosmeticSeed: card.cosmeticSeed,
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
