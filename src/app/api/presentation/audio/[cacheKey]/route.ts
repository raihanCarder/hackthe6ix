import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/core";

const cacheKeySchema = z.string().regex(/^[a-f0-9]{64}$/);

export async function GET(
  _request: Request,
  context: { params: Promise<{ cacheKey: string }> },
) {
  try {
    await requireUser();
    const { cacheKey } = await context.params;
    const key = cacheKeySchema.parse(cacheKey);
    const asset = await prisma.presentationAudio.findUnique({ where: { cacheKey: key } });
    if (!asset) throw new ApiError(404, "Commentary audio not found");

    return new NextResponse(Buffer.from(asset.audio), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.audio.byteLength),
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
