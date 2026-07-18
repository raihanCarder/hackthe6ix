import { NextResponse } from "next/server";
import { getCurrentUserPayload, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json(await getCurrentUserPayload());
  } catch (error) {
    return handleApiError(error);
  }
}
