import { NextResponse } from "next/server";
import { handleApiError, listPackOpens, requireUser } from "@/lib/api";

/** The user's pack-opening history, most recent first (used by the Pack Lab list). */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ packs: await listPackOpens(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
