import { NextResponse, type NextRequest } from "next/server";
import { callDuelStat, callStatSchema, handleApiError, requireUser } from "@/lib/api";

/** Call a stat category on the current round's active card. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = callStatSchema.parse(await request.json());
    return NextResponse.json(await callDuelStat(user, id, body));
  } catch (error) {
    return handleApiError(error);
  }
}
