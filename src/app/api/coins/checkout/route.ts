import { NextResponse, type NextRequest } from "next/server";
import {
  createCoinCheckoutSchema,
  createCoinCheckoutSession,
  handleApiError,
  requireUser,
} from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { tierId } = createCoinCheckoutSchema.parse(await request.json());
    return NextResponse.json(
      await createCoinCheckoutSession(user, tierId, request.nextUrl.origin),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
