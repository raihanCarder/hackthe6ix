import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, requireUser, sellCards, sellCardsSchema } from "@/lib/api";

/**
 * Sell (delete) one or more saved cards, crediting the user with coins based
 * on each card's rarity and OVR. See `cardSellValue` in lib/game/cardStats.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { cardIds } = sellCardsSchema.parse(await request.json());
    return NextResponse.json(await sellCards(user, cardIds));
  } catch (error) {
    return handleApiError(error);
  }
}
