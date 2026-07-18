import { NextResponse, type NextRequest } from "next/server";
import {
  handleApiError,
  openPack,
  openPackSchema,
  requireUser,
} from "@/lib/api";

/**
 * Open a Trip Pack: five cards drawn from the eligible live pool.
 * First pack per normalized city is free; later packs cost currency.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchId } = openPackSchema.parse(await request.json());
    return NextResponse.json(await openPack(user, searchId));
  } catch (error) {
    return handleApiError(error);
  }
}
