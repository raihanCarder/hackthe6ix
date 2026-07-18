import "server-only";
import { z } from "zod";
import { QUESTION_BANK } from "@/lib/engine/questionnaire";
import type {
  MetricAvailability,
  PreferenceQuestion,
  TravelerAnswer,
  TripContext,
} from "@/lib/engine/types";

const geminiQuestionSchema = z.object({
  questionId: z.string().min(1).max(64),
  text: z.string().trim().min(8).max(180),
  optionLabels: z.array(
    z.object({
      optionId: z.string().min(1).max(64),
      label: z.string().trim().min(1).max(90),
    }),
  ).min(2).max(8),
});

interface GeminiQuestionContext {
  trip: TripContext;
  availability: MetricAvailability[];
  answers: TravelerAnswer[];
  candidates: PreferenceQuestion[];
}

/**
 * Ask Gemini to select and reword one approved question. Metric effects and
 * IDs always come from QUESTION_BANK; model output can never alter scoring.
 */
export async function generateAdaptiveQuestion(
  context: GeminiQuestionContext,
): Promise<PreferenceQuestion | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || context.candidates.length === 0) return null;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const prompt = buildPrompt(context);
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
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.35,
            maxOutputTokens: 600,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) {
      console.warn(`Gemini questionnaire request failed with status ${response.status}`);
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

    const generated = geminiQuestionSchema.parse(JSON.parse(text));
    const approved = context.candidates.find((question) => question.id === generated.questionId);
    if (!approved) return null;

    const labels = new Map(generated.optionLabels.map((option) => [option.optionId, option.label]));
    if (approved.options.some((option) => !labels.has(option.id))) return null;

    return {
      ...approved,
      text: generated.text,
      options: approved.options.map((option) => ({
        ...option,
        label: labels.get(option.id) as string,
      })),
    };
  } catch (error) {
    console.warn(
      "Gemini questionnaire generation failed; using deterministic fallback",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

function buildPrompt(context: GeminiQuestionContext): string {
  const answerSummary = context.answers.map((answer) => {
    const question = QUESTION_BANK.find((candidate) => candidate.id === answer.questionId);
    const labels = answer.optionIds
      .map((id) => question?.options.find((option) => option.id === id)?.label)
      .filter(Boolean);
    return { question: question?.text ?? answer.questionId, answers: labels };
  });
  const metricSummary = context.availability.map((metric) => ({
    metric: metric.metric,
    status: metric.status,
    coverage: Math.round(metric.coverage * 100),
    variation: Math.round(metric.variation * 100) / 100,
  }));
  const candidates = context.candidates.map((question) => ({
    id: question.id,
    originalText: question.text,
    options: question.options.map((option) => ({
      id: option.id,
      originalLabel: option.label,
      effects: option.effects,
    })),
  }));

  return [
    "You personalize a short hotel-preference interview.",
    "Choose exactly one candidate question. Rephrase its text and every option label for this traveler.",
    "Keep each option semantically equivalent to its original label and scoring effects.",
    "Do not add hotel facts, prices, amenities, safety claims, or new preferences.",
    "Use previous answers to make the next question feel relevant and avoid repeating what is already known.",
    "Return only JSON: {questionId, text, optionLabels:[{optionId,label}]}",
    JSON.stringify({
      trip: {
        destination: context.trip.destinationLabel,
        checkin: context.trip.checkin,
        checkout: context.trip.checkout,
        adults: context.trip.adults,
        children: context.trip.children,
        rooms: context.trip.rooms,
        currency: context.trip.currency,
      },
      availableMetrics: metricSummary,
      previousAnswers: answerSummary,
      candidates,
    }),
  ].join("\n");
}
