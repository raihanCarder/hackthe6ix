import "server-only";
import { z } from "zod";
import { geminiRecapTimeoutMs } from "./config";
import {
  tournamentRecapFacts,
  validateGeneratedRecap,
  type TournamentRecapEvent,
} from "@/lib/presentation/recap";

const recapSchema = z.object({
  recap: z.string().trim().min(80).max(550),
});

const RATE_LIMIT_BACKOFF_MS = 5 * 60_000;
const TRANSIENT_BACKOFF_MS = 30_000;
const globalRecapState = globalThis as unknown as {
  geminiRecapRetryAfter?: number;
  geminiRecapLastWarningAt?: number;
};

/** Gemini authors presentation prose from a closed set of trusted tournament facts. */
export async function generateTournamentRecap(
  event: TournamentRecapEvent,
): Promise<string | null> {
  if (process.env.GEMINI_RECAP_ENABLED === "false") return null;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || (globalRecapState.geminiRecapRetryAfter ?? 0) > Date.now()) return null;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(event) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.55,
            maxOutputTokens: 220,
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(geminiRecapTimeoutMs()),
      },
    );
    if (!response.ok) {
      globalRecapState.geminiRecapRetryAfter = Date.now()
        + (response.status === 429 ? RATE_LIMIT_BACKOFF_MS : TRANSIENT_BACKOFF_MS);
      warnOnce(`Gemini tournament recap failed with status ${response.status}`);
      return null;
    }

    const body = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) return null;
    const generated = recapSchema.parse(JSON.parse(text));
    const validated = validateGeneratedRecap(generated.recap, event);
    if (!validated) {
      globalRecapState.geminiRecapRetryAfter = Date.now() + TRANSIENT_BACKOFF_MS;
      warnOnce("Gemini tournament recap failed grounding validation");
    }
    return validated;
  } catch (error) {
    globalRecapState.geminiRecapRetryAfter = Date.now() + TRANSIENT_BACKOFF_MS;
    warnOnce(
      "Gemini tournament recap failed; using deterministic fallback",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

function buildPrompt(event: TournamentRecapEvent): string {
  return [
    "Write a lively full-time sports recap for a hotel-card tournament.",
    "Use 2 or 3 sentences and 45 to 80 words.",
    "Use the exact champion, runner-up, competition, score, record, metrics, probability, and rewards supplied below.",
    "Mention both hotel names, the competition name, and the final score.",
    "Do not invent amenities, prices, ratings, locations, match events, comebacks, upsets, or hotel facts.",
    "Do not change the result or imply that presentation affected it.",
    "For a casual competition, do not describe the champion as a personalized recommendation.",
    "Return only JSON: {\"recap\":\"...\"}.",
    JSON.stringify(tournamentRecapFacts(event)),
  ].join("\n");
}

function warnOnce(message: string, detail?: string): void {
  const now = Date.now();
  if (now - (globalRecapState.geminiRecapLastWarningAt ?? 0) < TRANSIENT_BACKOFF_MS) return;
  globalRecapState.geminiRecapLastWarningAt = now;
  console.warn(message, detail ?? "");
}
