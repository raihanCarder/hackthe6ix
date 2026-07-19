import { NextResponse, type NextRequest } from "next/server";
import { cancelDuel, handleApiError, requireUser } from "@/lib/api";

/** Leave the waiting room. */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await cancelDuel(user, id));
  } catch (error) {
    return handleApiError(error);
  }
}
