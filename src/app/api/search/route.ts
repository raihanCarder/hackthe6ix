import { NextResponse, type NextRequest } from "next/server";
import { createSearch, handleApiError, requireUser, searchRequestSchema } from "@/lib/api";

/**
 * Trip search: fetch live Stay22 results server-side, persist the API call
 * and normalized snapshots for history/replay, and report pool stats.
 * The Stay22 key never appears in any response.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = searchRequestSchema.parse(await request.json());
    return NextResponse.json(await createSearch(user, body));
  } catch (error) {
    return handleApiError(error);
  }
}
