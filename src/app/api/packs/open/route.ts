import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { applyHardConstraints } from "@/lib/engine";
import { createRng, hashString } from "@/lib/engine/seed";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/types";
import {
  assignRarity,
  computeCardStats,
  deriveCosmeticSeed,
  overallRating,
  poolPriceContext,
} from "@/lib/game/cardStats";
import { ApiError, asJson, handleApiError, loadSearch, PACK_COST, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ searchId: z.string().min(1) });
const PACK_SIZE = 5;

/**
 * Open a Trip Pack: five cards drawn from the eligible live pool.
 * First pack per normalized city is free; later packs cost currency.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchId } = schema.parse(await request.json());
    const search = await loadSearch(searchId, user.id);

    const { eligible } = applyHardConstraints(search.pool, search.trip, DEFAULT_ENGINE_CONFIG);
    if (eligible.length < PACK_SIZE) {
      throw new ApiError(422, "Not enough eligible properties for a pack — try wider trip inputs");
    }

    const owned = new Set(
      (
        await prisma.savedCard.findMany({
          where: { userId: user.id },
          select: { stay22PropertyId: true },
        })
      ).map((c) => c.stay22PropertyId),
    );
    const selectable = eligible.filter((h) => !owned.has(h.id));
    if (selectable.length === 0) {
      throw new ApiError(422, "You already own every bookable card in this search");
    }

    const claim = await prisma.cityPackClaim.findUnique({
      where: { userId_normalizedCity: { userId: user.id, normalizedCity: search.city } },
    });
    const cost = claim ? PACK_COST : 0;
    if (cost > user.currency) {
      throw new ApiError(402, `Not enough coins — this pack costs ${cost}`);
    }

    // Deterministic draw for audit: seeded shuffle, with one high-rated card
    // guaranteed when available so packs always feel like a real pull.
    const seed = hashString(`pack:${searchId}:${user.id}:${user.packsOpened}`);
    const rng = createRng(seed);
    const shuffled = [...selectable].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, Math.min(PACK_SIZE, shuffled.length));
    const banger = selectable
      .filter((h) => (h.guestRating ?? 0) >= 8.5)
      .sort((a, b) => (b.guestRating ?? 0) - (a.guestRating ?? 0))[0];
    if (banger && !picked.some((h) => h.id === banger.id)) {
      picked[picked.length - 1] = banger;
    }

    const prices = poolPriceContext(eligible);
    const snapshots = await prisma.hotelSnapshot.findMany({
      where: { sourceApiCallId: searchId, stay22PropertyId: { in: picked.map((h) => h.id) } },
    });
    const snapshotByProperty = new Map(snapshots.map((s) => [s.stay22PropertyId, s.id]));

    const created = await prisma.$transaction(async (tx) => {
      const cards = [];
      for (const hotel of picked) {
        const cosmeticSeed = deriveCosmeticSeed(seed, hotel.id);
        cards.push(
          await tx.savedCard.create({
            data: {
              userId: user.id,
              stay22PropertyId: hotel.id,
              snapshotId: snapshotByProperty.get(hotel.id)!,
              rarity: assignRarity(hotel.id, cosmeticSeed),
              cosmeticSeed,
              acquiredScope: "trip",
              acquiredCity: search.city,
            },
          }),
        );
      }
      const pack = await tx.packOpen.create({
        data: {
          userId: user.id,
          searchApiCallId: searchId,
          scope: "trip",
          city: search.city,
          cost,
          seed,
          generatedCardIds: asJson(cards.map((c) => c.id)),
        },
      });
      if (!claim) {
        await tx.cityPackClaim.create({
          data: { userId: user.id, normalizedCity: search.city },
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: { packsOpened: { increment: 1 }, currency: { decrement: cost } },
      });
      return { pack, cards };
    });

    const hotelById = new Map(picked.map((h) => [h.id, h]));
    return NextResponse.json({
      packId: created.pack.id,
      seed,
      cost,
      cards: created.cards.map((card) => {
        const hotel = hotelById.get(card.stay22PropertyId)!;
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
