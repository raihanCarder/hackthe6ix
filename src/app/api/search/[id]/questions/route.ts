import { NextResponse, type NextRequest } from "next/server";
import { getSearchQuestions, handleApiError, requireUser } from "@/lib/api";

/**
 * Adaptive questionnaire for a stored search: only questions whose metrics
 * actually vary in this pool are offered (documentation/ideas/ALGORITHM_DESIGN.md §3).
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getSearchQuestions(id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
