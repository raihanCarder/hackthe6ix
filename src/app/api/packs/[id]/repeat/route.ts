import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, repeatPack, requireUser } from "@/lib/api";

/** Open another pack from the reveal screen. Global repeats draw a new random city. */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await repeatPack(user, id));
  } catch (error) {
    return handleApiError(error);
  }
}
