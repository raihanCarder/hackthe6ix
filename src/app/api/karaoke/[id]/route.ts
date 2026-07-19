import { NextResponse, type NextRequest } from "next/server";
import { getKaraokeDuelView, handleApiError, requireUser } from "@/lib/api";

/** Full karaoke duel state for this participant, triggering generation/judging as needed. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getKaraokeDuelView(user, id));
  } catch (error) {
    return handleApiError(error);
  }
}
