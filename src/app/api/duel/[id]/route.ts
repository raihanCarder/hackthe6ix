import { NextResponse, type NextRequest } from "next/server";
import { getDuelView, handleApiError, requireUser } from "@/lib/api";

/** Full duel state for this participant (opponent's un-played cards are never included). */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getDuelView(user, id));
  } catch (error) {
    return handleApiError(error);
  }
}
