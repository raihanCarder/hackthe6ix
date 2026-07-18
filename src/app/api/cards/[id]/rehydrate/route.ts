import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, rehydrateSavedCard, requireUser } from "@/lib/api";

/**
 * Live refresh for a saved card: re-fetch from Stay22 for current price,
 * policies, and booking link. Stale cards stay visible but unbookable
 * ("Transfer Pending", documentation/ideas/IDEA.md).
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await rehydrateSavedCard(user, id));
  } catch (error) {
    return handleApiError(error);
  }
}
