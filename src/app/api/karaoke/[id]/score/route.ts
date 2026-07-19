import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, requireUser, submitKaraokeScoreSchema, submitKaraokeSongScore } from "@/lib/api";

/** Submit this player's mic-measured sing-along loudness (0-100). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = submitKaraokeScoreSchema.parse(await request.json());
    return NextResponse.json(await submitKaraokeSongScore(user, id, body));
  } catch (error) {
    return handleApiError(error);
  }
}
