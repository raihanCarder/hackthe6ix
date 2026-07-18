import { NextResponse, type NextRequest } from "next/server";
import {
  handleApiError,
  openPack,
  openPackSchema,
  requireUser,
} from "@/lib/api";

/**
 * Open a Trip or Global Pack: five cards drawn from the eligible pool.
 * First Trip Pack per normalized city is free; Global Packs always cost currency.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchId, scope } = openPackSchema.parse(await request.json());
    return NextResponse.json(await openPack(user, searchId, scope));
  } catch (error) {
    return handleApiError(error);
  }
}
