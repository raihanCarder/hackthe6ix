import { NextResponse, type NextRequest } from "next/server";
import { applyHardConstraints, calculatePoolMetrics, selectAdaptiveQuestions } from "@/lib/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/types";
import { handleApiError, loadSearch, requireUser } from "@/lib/api";

/**
 * Adaptive questionnaire for a stored search: only questions whose metrics
 * actually vary in this pool are offered (ALGORITHM_DESIGN.md §3).
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const search = await loadSearch(id, user.id);

    const { eligible } = applyHardConstraints(search.pool, search.trip, DEFAULT_ENGINE_CONFIG);
    const { availability, activeMetrics } = calculatePoolMetrics(
      eligible,
      search.trip,
      DEFAULT_ENGINE_CONFIG,
    );
    const questions = selectAdaptiveQuestions({
      activeMetrics,
      availability,
      partySize: search.trip.adults + search.trip.children,
    });

    return NextResponse.json({
      questions,
      activeMetrics,
      availability: availability.map((a) => ({
        metric: a.metric,
        status: a.status,
        coverage: Math.round(a.coverage * 100) / 100,
        reason: a.reason,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
