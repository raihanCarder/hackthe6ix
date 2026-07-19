import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getCurrentUserPayload,
  handleApiError,
  requireUser,
  updateProfileSchema,
  updateUserProfile,
} from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json(await getCurrentUserPayload());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const data = updateProfileSchema.parse(await request.json());
    return NextResponse.json(await updateUserProfile(user.id, data));
  } catch (error) {
    return handleApiError(error);
  }
}
