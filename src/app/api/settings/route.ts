import { NextRequest, NextResponse } from "next/server";
import { getUserSettings, handleApiError, requireUser, updateSettingsSchema, updateUserSettings } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(getUserSettings(user));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const data = updateSettingsSchema.parse(await request.json());
    return NextResponse.json(await updateUserSettings(user.id, data));
  } catch (error) {
    return handleApiError(error);
  }
}
