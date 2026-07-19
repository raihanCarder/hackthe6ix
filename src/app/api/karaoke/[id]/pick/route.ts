import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, pickKaraokeCardSchema, pickKaraokeSongCard, requireUser } from "@/lib/api";

/** Pick which of your hotels to sing about, once matched. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = pickKaraokeCardSchema.parse(await request.json());
    return NextResponse.json(await pickKaraokeSongCard(user, id, body));
  } catch (error) {
    return handleApiError(error);
  }
}
