import { NextResponse, type NextRequest } from "next/server";
import { rehydrateProperty } from "@/lib/stay22/client";
import { ApiError, handleApiError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Live refresh for a saved card: re-fetch from Stay22 for current price,
 * policies, and booking link. Stale cards stay visible but unbookable
 * ("Transfer Pending", IDEA.md).
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const card = await prisma.savedCard.findFirst({
      where: { id, userId: user.id },
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

    if (!live) {
      return NextResponse.json({ available: false, status: "TRANSFER_PENDING" });
    }
    return NextResponse.json({ available: true, hotel: live });
  } catch (error) {
    return handleApiError(error);
  }
}
