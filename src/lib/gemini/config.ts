const DEFAULT_QUESTION_TIMEOUT_MS = 1_800;
const MIN_QUESTION_TIMEOUT_MS = 500;
const MAX_QUESTION_TIMEOUT_MS = 5_000;

/** Keep adaptive questions responsive even when Gemini is slow or unavailable. */
export function geminiQuestionTimeoutMs(value = process.env.GEMINI_QUESTION_TIMEOUT_MS): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_QUESTION_TIMEOUT_MS;
  return Math.min(MAX_QUESTION_TIMEOUT_MS, Math.max(MIN_QUESTION_TIMEOUT_MS, parsed));
}
