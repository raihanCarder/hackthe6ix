const DEFAULT_QUESTION_TIMEOUT_MS = 1_800;
const MIN_QUESTION_TIMEOUT_MS = 500;
const MAX_QUESTION_TIMEOUT_MS = 5_000;
const DEFAULT_RECAP_TIMEOUT_MS = 3_500;
const MIN_RECAP_TIMEOUT_MS = 1_000;
const MAX_RECAP_TIMEOUT_MS = 8_000;

/** Keep adaptive questions responsive even when Gemini is slow or unavailable. */
export function geminiQuestionTimeoutMs(value = process.env.GEMINI_QUESTION_TIMEOUT_MS): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_QUESTION_TIMEOUT_MS;
  return Math.min(MAX_QUESTION_TIMEOUT_MS, Math.max(MIN_QUESTION_TIMEOUT_MS, parsed));
}

/** Recaps prewarm during the final, so they can use a slightly larger latency budget. */
export function geminiRecapTimeoutMs(value = process.env.GEMINI_RECAP_TIMEOUT_MS): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RECAP_TIMEOUT_MS;
  return Math.min(MAX_RECAP_TIMEOUT_MS, Math.max(MIN_RECAP_TIMEOUT_MS, parsed));
}
