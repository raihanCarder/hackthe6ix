import "server-only";
import { z } from "zod";
import type { NormalizedAccommodation } from "@/lib/engine/types";

const GEMINI_TIMEOUT_MS = 8_000;

const lyricsSchema = z.object({
  title: z.string().trim().min(1).max(80),
  lyrics: z.string().trim().min(20).max(1200),
});

export interface KaraokeSong {
  title: string;
  lyrics: string;
}

/**
 * Ask Gemini for a short, hotel-specific karaoke song. Falls back to a
 * deterministic templated song when Gemini is unavailable, so the mode
 * always produces a playable duel (mirrors the fallback philosophy in
 * src/lib/gemini/questions.ts).
 */
export async function generateKaraokeLyrics(hotel: NormalizedAccommodation): Promise<KaraokeSong> {
  const facts = pickRandomFacts(hotel, 2);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return fallbackLyrics(hotel, facts);

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(hotel, facts) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.9,
            maxOutputTokens: 500,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );
    if (!response.ok) return fallbackLyrics(hotel, facts);

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) return fallbackLyrics(hotel, facts);

    return lyricsSchema.parse(JSON.parse(text));
  } catch (error) {
    console.warn("Gemini karaoke lyrics generation failed; using fallback song", error);
    return fallbackLyrics(hotel, facts);
  }
}

interface HotelFact {
  label: string;
  value: string;
}

/**
 * Two random Stay22-sourced facts about the hotel, so each song riffs on
 * different specific details instead of the same full stat dump every time.
 * Gemini decides which (if any) are worth singing about — see buildPrompt.
 */
function pickRandomFacts(hotel: NormalizedAccommodation, count: number): HotelFact[] {
  const candidates: HotelFact[] = [];
  if (hotel.guestRating !== null) candidates.push({ label: "guest rating", value: `${hotel.guestRating}/10` });
  if (hotel.stars !== null) candidates.push({ label: "star rating", value: `${hotel.stars} stars` });
  if (hotel.reviewCount !== null) candidates.push({ label: "review count", value: `${hotel.reviewCount} reviews` });
  if (hotel.propertyType) candidates.push({ label: "property type", value: hotel.propertyType });
  if (hotel.capacity !== null) candidates.push({ label: "guest capacity", value: `sleeps ${hotel.capacity}` });
  if (hotel.bedrooms !== null) candidates.push({ label: "bedrooms", value: `${hotel.bedrooms}` });
  if (hotel.beds !== null) candidates.push({ label: "beds", value: `${hotel.beds}` });
  if (hotel.bathrooms !== null) candidates.push({ label: "bathrooms", value: `${hotel.bathrooms}` });
  if (hotel.freeCancellation !== null) {
    candidates.push({ label: "free cancellation", value: hotel.freeCancellation ? "yes" : "no" });
  }
  if (hotel.instantBooking !== null) {
    candidates.push({ label: "instant booking", value: hotel.instantBooking ? "yes" : "no" });
  }
  if (hotel.distanceKm !== null) {
    candidates.push({ label: "distance from destination", value: `${hotel.distanceKm.toFixed(1)} km` });
  }
  if (hotel.nightlyPrice !== null) candidates.push({ label: "nightly price", value: `$${hotel.nightlyPrice}` });

  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function buildPrompt(hotel: NormalizedAccommodation, facts: HotelFact[]): string {
  return [
    "Write JUST the chorus/hook of a rowdy singalong bar song hyping up a specific hotel stay, for a lighthearted 1v1 game where two players each sing about their own hotel.",
    "No verse, no intro — only the chorus. About 4 short lines, roughly 10 seconds' worth when sung. Punchy, repeatable, easy for a crowd to shout back on one breath.",
    "Think a crowd of friends banging mugs on the table, chanting along — warm but catty: sassy, playfully shady, a little smug about how much better this hotel obviously is than whatever the other guy's got. Petty in a fun way, not mean-spirited.",
    "Reference the hotel's real name and location naturally. Do not invent amenities, prices, or ratings beyond what's given.",
    facts.length
      ? `Here are ${facts.length === 1 ? "a fact" : "two facts"} about the hotel: ${facts
          .map((f) => `${f.label} — ${f.value}`)
          .join("; ")}. You may work in zero, one, or both of them, whichever makes the better song — but only use a fact if it reads as genuinely positive or complimentary about the stay. Skip any fact that would come across as a downside (e.g. no free cancellation, no instant booking, a long distance from the destination, a low rating) rather than force it in.`
      : "No further details are available — keep it to the name and location.",
    "Return only JSON: {title, lyrics}. `lyrics` should be just the chorus lines, tagged \"[Chorus]\\nline one\\n...\" — no other sections.",
    JSON.stringify({
      name: hotel.name,
      city: hotel.countryName,
      countryCode: hotel.countryCode,
    }),
  ].join("\n");
}

function fallbackLyrics(hotel: NormalizedAccommodation, facts: HotelFact[]): KaraokeSong {
  const name = hotel.name ?? "this hotel";
  const place = hotel.countryName ?? "somewhere new";
  const fact = facts[0] ?? null;
  const factLine = fact
    ? `They've got the ${fact.label} to prove it — ${fact.value}, wow,`
    : `Rolled in tired from ${place}, we're the only crew that's crowned,`;
  return {
    title: `The Ballad of ${name}`,
    lyrics: [
      "[Chorus]",
      `Oh ${name}, oh ${name}, sing it with the crowd,`,
      factLine,
      `Oh ${name}, oh ${name}, one more cheer somehow,`,
      "Nice try, other hotel — take a bow and sit down now.",
    ].join("\n"),
  };
}
