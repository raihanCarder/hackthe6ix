import "server-only";
import { z } from "zod";

const selectionSchema = z.object({ templateIndex: z.number().int().min(0) });
const globalSelectionCache = globalThis as unknown as {
  commentarySelections?: Map<string, number | null>;
  geminiRetryAfter?: number;
};
const selectionCache = globalSelectionCache.commentarySelections ?? new Map<string, number | null>();
globalSelectionCache.commentarySelections = selectionCache;

/**
 * Gemini may choose among approved lines, but it never authors hotel claims or
 * receives any control over game results. Failure is an instant deterministic fallback.
 */
export async function chooseCommentaryCandidate(
  eventId: string,
  choices: string[],
): Promise<number | null> {
  if (process.env.GEMINI_COMMENTARY_ENABLED !== "true" || choices.length < 2) return null;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if ((globalSelectionCache.geminiRetryAfter ?? 0) > Date.now()) return null;
  if (selectionCache.has(eventId)) return selectionCache.get(eventId) ?? null;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: [
                "Choose the most entertaining sports-commentary line for this moment.",
                "You may only return the index of an existing line; never write or alter facts.",
                "Return JSON only: {templateIndex:number}.",
                JSON.stringify({ choices }),
              ].join("\n"),
            }],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 40,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(2_500),
      },
    );
    if (!response.ok) {
      if (response.status === 429) globalSelectionCache.geminiRetryAfter = Date.now() + 300_000;
      return null;
    }
    const body = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!text) return null;
    const selected = selectionSchema.parse(JSON.parse(text));
    const index = selected.templateIndex < choices.length ? selected.templateIndex : null;
    selectionCache.set(eventId, index);
    return index;
  } catch {
    return null;
  }
}
