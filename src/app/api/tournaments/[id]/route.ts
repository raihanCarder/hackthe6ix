import { NextResponse, type NextRequest } from "next/server";
import { getTournamentReplay, handleApiError, requireUser } from "@/lib/api";

/** Full tournament replay payload for the bracket UI. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getTournamentReplay(user, id));
  } catch (error) {
    return handleApiError(error);
  }
}
