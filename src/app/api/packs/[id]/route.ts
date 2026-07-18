import { NextResponse, type NextRequest } from "next/server";
import { getPackReplay, handleApiError, requireUser } from "@/lib/api";

/** Replay a pack opening (used by the reveal screen and history). */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getPackReplay(user, id));
  } catch (error) {
    return handleApiError(error);
  }
}
