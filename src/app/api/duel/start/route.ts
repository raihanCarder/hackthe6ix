import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, requireUser, startDuel, startDuelSchema } from "@/lib/api";

/** Join the waiting player, or start waiting if no one's queued. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = startDuelSchema.parse(await request.json());
    return NextResponse.json(await startDuel(user, body));
  } catch (error) {
    return handleApiError(error);
  }
}
