import { NextRequest, NextResponse } from "next/server";
import { searchCities } from "@/lib/cities";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchCities(query);
  return NextResponse.json({ results });
}
