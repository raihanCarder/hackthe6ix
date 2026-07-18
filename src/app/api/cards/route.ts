import { NextResponse } from "next/server";
import { getUserCollection, handleApiError, requireUser } from "@/lib/api";

/** The user's collection, rendered from stored snapshots (no live calls). */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await getUserCollection(user));
  } catch (error) {
    return handleApiError(error);
  }
}
