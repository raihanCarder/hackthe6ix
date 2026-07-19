import "server-only";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { applyHardConstraints } from "@/lib/engine";
import { createRng, hashString } from "@/lib/engine/seed";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/types";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import {
  assignRarity,
  collectibleOverallRating,
  computeCardStats,
  deriveCosmeticSeed,
  poolPriceContext,
} from "@/lib/game/cardStats";
import { prisma } from "@/lib/db";
import { ApiError, asJson, PACK_COST } from "./core";
import { loadSearch } from "./searches";

const PACK_SIZE = 5;

export const openPackSchema = z.object({
  searchId: z.string().min(1),
  scope: z.enum(["trip", "global"]),
});

export async function openPack(user: User, searchId: string, requestedScope: "trip" | "global") {
  const search = await loadSearch(searchId, user.id);
  if (requestedScope !== search.scope) {
    throw new ApiError(409, "Pack type does not match the original search");
  }
  const scope = search.scope;

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
  if (selectable.length < PACK_SIZE) {
    throw new ApiError(
      422,
      `Only ${selectable.length} new properties remain — a pack needs ${PACK_SIZE}`,
    );
  }

  const claim =
    scope === "trip"
      ? await prisma.cityPackClaim.findUnique({
          where: { userId_normalizedCity: { userId: user.id, normalizedCity: search.city } },
        })
      : null;
  const cost = scope === "global" ? PACK_COST : claim ? PACK_COST : 0;
  if (cost > user.currency) {
    throw new ApiError(402, `Not enough coins — this pack costs ${cost}`);
  }

  const seed = hashString(`pack:${searchId}:${user.id}:${user.packsOpened}`);
  const picked = pickPackCards(selectable, seed);
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
            acquiredScope: scope,
            acquiredCity: search.city,
          },
        }),
      );
    }
    const pack = await tx.packOpen.create({
      data: {
        userId: user.id,
        searchApiCallId: searchId,
        scope,
        city: search.city,
        cost,
        seed,
        generatedCardIds: asJson(cards.map((c) => c.id)),
      },
    });
    if (scope === "trip" && !claim) {
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
  return {
    packId: created.pack.id,
    scope,
    seed,
    cost,
    cards: created.cards.map((card) => {
      const hotel = hotelById.get(card.stay22PropertyId)!;
      const stats = computeCardStats(hotel, prices);
      return {
        id: card.id,
        propertyId: card.stay22PropertyId,
        rarity: card.rarity,
        cosmeticSeed: card.cosmeticSeed,
        stats,
        overall: collectibleOverallRating(stats, card.rarity),
        hotel,
      };
    }),
  };
}

export async function listPackOpens(user: User) {
  const packs = await prisma.packOpen.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return packs.map((pack) => ({
    packId: pack.id,
    scope: pack.scope,
    city: pack.city,
    cost: pack.cost,
    cardCount: (pack.generatedCardIds as unknown as string[]).length,
    createdAt: pack.createdAt.toISOString(),
  }));
}

export async function getPackReplay(user: User, packId: string) {
  const pack = await prisma.packOpen.findFirst({ where: { id: packId, userId: user.id } });
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

  return {
    packId: pack.id,
    searchId: pack.searchApiCallId,
    scope: pack.scope,
    city: pack.city,
    cost: pack.cost,
    seed: pack.seed,
    trip: search.trip,
    cards: cardIds
      .map((cardId) => byId.get(cardId))
      .filter((c) => c !== undefined)
      .map((card) => {
        const hotel = card.snapshot.normalizedData as unknown as NormalizedAccommodation;
        const stats = computeCardStats(hotel, prices);
        return {
          id: card.id,
          propertyId: card.stay22PropertyId,
          rarity: card.rarity,
          cosmeticSeed: card.cosmeticSeed,
          stats,
          overall: collectibleOverallRating(stats, card.rarity),
          hotel,
        };
      }),
  };
}

function pickPackCards(selectable: NormalizedAccommodation[], seed: string) {
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
  return picked;
}
