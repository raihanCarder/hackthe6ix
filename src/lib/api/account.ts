import "server-only";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type ResetTable =
  | "CityPackClaim"
  | "CoinPurchase"
  | "Duel"
  | "HotelSnapshot"
  | "PackOpen"
  | "SavedCard"
  | "Stay22ApiCall"
  | "Tournament";

async function existingResetTables(): Promise<Set<ResetTable>> {
  const rows = await prisma.$queryRaw<Array<{ table_name: ResetTable }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'CityPackClaim',
        'CoinPurchase',
        'Duel',
        'HotelSnapshot',
        'PackOpen',
        'SavedCard',
        'Stay22ApiCall',
        'Tournament'
      )
  `;
  return new Set(rows.map((row) => row.table_name));
}

export async function resetUserAccount(user: User) {
  const tables = await existingResetTables();
  const hasTable = (table: ResetTable) => tables.has(table);

  return prisma.$transaction(async (tx) => {
    const apiCalls = hasTable("Stay22ApiCall")
      ? await tx.stay22ApiCall.findMany({
          where: { userId: user.id },
          select: { id: true },
        })
      : [];
    const apiCallIds = apiCalls.map((call) => call.id);

    if (hasTable("Duel")) {
      await tx.duel.deleteMany({
        where: {
          OR: [{ player1Id: user.id }, { player2Id: user.id }],
        },
      });
    }
    if (hasTable("SavedCard")) await tx.savedCard.deleteMany({ where: { userId: user.id } });
    if (hasTable("Tournament")) await tx.tournament.deleteMany({ where: { userId: user.id } });
    if (hasTable("PackOpen")) await tx.packOpen.deleteMany({ where: { userId: user.id } });
    if (hasTable("CityPackClaim")) await tx.cityPackClaim.deleteMany({ where: { userId: user.id } });
    if (hasTable("CoinPurchase")) await tx.coinPurchase.deleteMany({ where: { userId: user.id } });

    if (apiCallIds.length > 0 && hasTable("HotelSnapshot")) {
      await tx.hotelSnapshot.deleteMany({
        where: { sourceApiCallId: { in: apiCallIds } },
      });
    }
    if (apiCallIds.length > 0 && hasTable("Stay22ApiCall")) {
      await tx.stay22ApiCall.deleteMany({
        where: { id: { in: apiCallIds } },
      });
    }

    await tx.user.delete({ where: { id: user.id } });
    return { ok: true };
  });
}
