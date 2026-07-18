import type {
  EngineConfig,
  Metric,
  MetricAvailability,
  NormalizedWeights,
  PreferencePoints,
  PreferenceQuestion,
  TravelerAnswer,
} from "./types";

export const QUESTION_BANK_VERSION = "cic-questions-1.0.0";

/**
 * Approved question bank (documentation/ideas/ALGORITHM_DESIGN.md §3). Point effects are
 * transparent MVP design choices, not learned preferences.
 */
export const QUESTION_BANK: PreferenceQuestion[] = [
  {
    id: "q_priority",
    text: "What matters most for this trip?",
    type: "single_select",
    options: [
      { id: "priority_location", label: "Best location", effects: { location: 30, quality: 5 } },
      { id: "priority_quality", label: "Best reviews", effects: { quality: 30, dataConfidence: 10 } },
      { id: "priority_space", label: "Enough space", effects: { groupFit: 35 } },
      { id: "priority_flex", label: "Flexible booking", effects: { flexibility: 35 } },
      {
        id: "priority_value",
        label: "Best value",
        effects: { value: 30, quality: 5 },
      },
      {
        id: "priority_balanced",
        label: "Balanced overall",
        effects: { quality: 10, location: 10, groupFit: 10, flexibility: 10, dataConfidence: 5 },
      },
    ],
  },
  {
    id: "q_trip_type",
    text: "What kind of trip is this?",
    type: "single_select",
    options: [
      { id: "trip_event", label: "Event / concert", effects: { location: 20, quality: 5, flexibility: 5 } },
      { id: "trip_family", label: "Family", effects: { groupFit: 20, flexibility: 10, quality: 5 } },
      { id: "trip_friends", label: "Friends", effects: { groupFit: 15, location: 10, value: 5 } },
      { id: "trip_business", label: "Business", effects: { location: 15, quality: 10, flexibility: 5 } },
      { id: "trip_couple", label: "Couple getaway", effects: { quality: 15, location: 10, flexibility: 5 } },
      { id: "trip_solo", label: "Solo", effects: { location: 10, quality: 10, value: 10 } },
    ],
  },
  {
    id: "q_flexibility",
    text: "How fixed are your plans?",
    type: "single_select",
    condition: { requiredMetrics: ["flexibility"] },
    options: [
      { id: "flex_change", label: "Plans may change", effects: { flexibility: 25 } },
      { id: "flex_some", label: "Some flexibility helps", effects: { flexibility: 15 } },
      { id: "flex_fixed", label: "Dates are fixed", effects: { flexibility: 5 } },
      { id: "flex_none", label: "Cancellation doesn't matter", effects: {} },
    ],
  },
  {
    id: "q_tradeoff_location",
    text: "Would you accept lower reviews to stay closer?",
    type: "single_select",
    condition: {
      requiredMetrics: ["location", "quality"],
      previousAnswers: { q_priority: ["priority_location"] },
    },
    options: [
      { id: "tl_much", label: "Yes, much closer wins", effects: { location: 20 } },
      { id: "tl_small", label: "Only a small difference", effects: { location: 10, quality: 10 } },
      { id: "tl_no", label: "No, reviews matter more", effects: { quality: 20 } },
    ],
  },
  {
    id: "q_tradeoff_quality",
    text: "Would you stay farther away for better reviews?",
    type: "single_select",
    condition: {
      requiredMetrics: ["location", "quality"],
      previousAnswers: { q_priority: ["priority_quality"] },
    },
    options: [
      { id: "tq_yes", label: "Yes", effects: { quality: 20 } },
      { id: "tq_slight", label: "Slightly farther is fine", effects: { quality: 10, location: 10 } },
      { id: "tq_no", label: "No, stay close", effects: { location: 20 } },
    ],
  },
  {
    id: "q_tradeoff_value",
    text: "Would you pay more for much better reviews?",
    type: "single_select",
    condition: {
      requiredMetrics: ["value", "quality"],
      previousAnswers: { q_priority: ["priority_value"] },
    },
    options: [
      { id: "tv_no", label: "No, keep the price down", effects: { value: 20 } },
      { id: "tv_little", label: "A little more is fine", effects: { value: 10, quality: 10 } },
      { id: "tv_yes", label: "Yes, reviews win", effects: { quality: 20 } },
    ],
  },
  {
    id: "q_tradeoff_space",
    text: "Would you stay farther away for more space?",
    type: "single_select",
    condition: {
      requiredMetrics: ["groupFit", "location"],
      previousAnswers: { q_priority: ["priority_space"] },
    },
    options: [
      { id: "ts_yes", label: "Yes, space wins", effects: { groupFit: 20 } },
      { id: "ts_slight", label: "Slightly farther is fine", effects: { groupFit: 10, location: 10 } },
      { id: "ts_no", label: "No, stay close", effects: { location: 20 } },
    ],
  },
  {
    id: "q_style",
    text: "What kind of recommendation do you prefer?",
    type: "single_select",
    options: [
      { id: "style_safe", label: "Safe and reliable", effects: { dataConfidence: 25, quality: 10 } },
      {
        id: "style_balanced",
        label: "Balanced",
        effects: { quality: 5, location: 5, groupFit: 5, flexibility: 5 },
      },
      {
        id: "style_gem",
        label: "Hidden gem",
        effects: { quality: 10, dataConfidence: 5 },
        flags: ["allow_hidden_gem"],
      },
      {
        id: "style_surprise",
        label: "Surprise me",
        effects: {},
        flags: ["broaden_diversity", "lower_certainty"],
      },
    ],
  },
];

export interface QuestionnaireContext {
  activeMetrics: Metric[];
  availability: MetricAvailability[];
  partySize: number;
}

/**
 * Deterministic adaptive selection: a question is eligible only when every
 * metric it can influence is active and its conditions hold. Trade-off
 * questions carry a previousAnswers condition the client evaluates after the
 * priority answer; the server re-validates on submit.
 */
export function selectAdaptiveQuestions(context: QuestionnaireContext): PreferenceQuestion[] {
  const active = new Set(context.activeMetrics);
  return QUESTION_BANK.map((q) => pruneQuestion(q, active))
    .filter((q): q is PreferenceQuestion => q !== null)
    .filter((q) => {
      const cond = q.condition;
      if (!cond) return true;
      if (cond.requiredMetrics && !cond.requiredMetrics.every((m) => active.has(m))) return false;
      if (cond.minimumPartySize && context.partySize < cond.minimumPartySize) return false;
      if (cond.maximumPartySize && context.partySize > cond.maximumPartySize) return false;
      return true;
    });
}

/**
 * Keep only answers that reference an approved question and option. This is
 * used on the server before both Gemini prompting and recommendation scoring,
 * so a client cannot invent metric effects.
 */
export function normalizeTravelerAnswers(answers: TravelerAnswer[]): TravelerAnswer[] {
  const normalized = new Map<string, TravelerAnswer>();
  for (const answer of answers) {
    const question = QUESTION_BANK.find((candidate) => candidate.id === answer.questionId);
    if (!question) continue;
    const allowed = new Set(question.options.map((option) => option.id));
    const optionIds = [...new Set(answer.optionIds.filter((id) => allowed.has(id)))];
    if (optionIds.length === 0) continue;
    normalized.set(question.id, {
      questionId: question.id,
      optionIds: question.type === "single_select" ? optionIds.slice(0, 1) : optionIds,
    });
  }
  return [...normalized.values()];
}

/** Eligible approved questions for the next sequential questionnaire step. */
export function selectNextQuestionCandidates(
  context: QuestionnaireContext,
  answers: TravelerAnswer[],
): PreferenceQuestion[] {
  const normalized = normalizeTravelerAnswers(answers);
  const answered = new Set(normalized.map((answer) => answer.questionId));
  const eligible = selectAdaptiveQuestions(context)
    .filter((question) => !answered.has(question.id))
    .filter((question) => {
      const previous = question.condition?.previousAnswers;
      if (!previous) return true;
      return Object.entries(previous).every(([questionId, allowedOptions]) => {
        const answer = normalized.find((candidate) => candidate.questionId === questionId);
        return answer?.optionIds.some((optionId) => allowedOptions.includes(optionId)) ?? false;
      });
    });

  // Anchor the conversation in the primary priority. Gemini may personalize
  // its wording, but should not skip the most informative first dimension.
  if (normalized.length === 0) {
    const priority = eligible.find((question) => question.id === "q_priority");
    return priority ? [priority] : eligible.slice(0, 1);
  }
  return eligible;
}

/** Drop options whose primary (largest-effect) metric is inactive, e.g. "Best value" with no prices. */
function pruneQuestion(q: PreferenceQuestion, active: Set<Metric>): PreferenceQuestion | null {
  const options = q.options.filter((o) => {
    const entries = Object.entries(o.effects) as Array<[Metric, number]>;
    if (entries.length === 0) return true;
    const primary = entries.reduce((best, e) => (e[1] > best[1] ? e : best));
    return active.has(primary[0]) && entries.some(([m]) => active.has(m));
  });
  if (options.length < 2) return null;
  return { ...q, options };
}

export interface WeightComputation {
  points: PreferencePoints;
  weights: NormalizedWeights;
  flags: Set<string>;
  answeredCount: number;
}

export function applyAnswerEffects(
  answers: TravelerAnswer[],
  activeMetrics: Metric[],
  config: EngineConfig,
): WeightComputation {
  const points: PreferencePoints = {};
  for (const metric of activeMetrics) {
    points[metric] = config.baselinePoints;
  }
  const flags = new Set<string>();
  let answeredCount = 0;

  for (const answer of answers) {
    const question = QUESTION_BANK.find((q) => q.id === answer.questionId);
    if (!question) continue;
    let counted = false;
    for (const optionId of answer.optionIds) {
      const option = question.options.find((o) => o.id === optionId);
      if (!option) continue;
      counted = true;
      for (const [metric, delta] of Object.entries(option.effects) as Array<[Metric, number]>) {
        if (points[metric] === undefined) continue; // inactive metric — skip
        if (!Number.isFinite(delta) || delta < 0) continue;
        points[metric] = (points[metric] as number) + delta;
      }
      for (const flag of option.flags ?? []) flags.add(flag);
    }
    if (counted) answeredCount++;
  }

  return { points, weights: normalizePreferencePoints(points), flags, answeredCount };
}

export function normalizePreferencePoints(points: PreferencePoints): NormalizedWeights {
  const entries = Object.entries(points) as Array<[Metric, number]>;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) throw new Error("Preference points must be positive");
  const weights: NormalizedWeights = {};
  for (const [metric, value] of entries) {
    weights[metric] = value / total;
  }
  return weights;
}

/** Named deterministic fallback profiles (§4), in percent. */
export const FALLBACK_PROFILES: Record<string, Partial<Record<Metric, number>>> = {
  best_overall: { quality: 35, location: 30, groupFit: 20, flexibility: 10, dataConfidence: 5 },
  closest: { quality: 20, location: 55, groupFit: 10, flexibility: 10, dataConfidence: 5 },
  family_group: { quality: 20, location: 20, groupFit: 45, flexibility: 10, dataConfidence: 5 },
  best_reviewed: { quality: 55, location: 20, groupFit: 10, flexibility: 5, dataConfidence: 10 },
  flexible_low_risk: { quality: 20, location: 15, groupFit: 10, flexibility: 40, dataConfidence: 15 },
  best_value: { quality: 20, location: 15, groupFit: 10, flexibility: 5, dataConfidence: 5, value: 45 },
};

export function profileWeights(profile: string, activeMetrics: Metric[]): NormalizedWeights {
  const base = FALLBACK_PROFILES[profile] ?? FALLBACK_PROFILES.best_overall;
  const points: PreferencePoints = {};
  for (const metric of activeMetrics) {
    const p = base[metric];
    if (p !== undefined && p > 0) points[metric] = p;
  }
  if (Object.keys(points).length === 0) {
    for (const metric of activeMetrics) points[metric] = 1;
  }
  return normalizePreferencePoints(points);
}
