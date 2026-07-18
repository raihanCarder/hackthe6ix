import { describe, expect, it } from "vitest";
import {
  normalizeTravelerAnswers,
  selectNextQuestionCandidates,
} from "./questionnaire";
import type { QuestionnaireContext } from "./questionnaire";

const context: QuestionnaireContext = {
  activeMetrics: ["quality", "location", "groupFit", "flexibility", "dataConfidence", "value"],
  availability: [],
  partySize: 3,
};

describe("sequential adaptive questionnaire", () => {
  it("anchors the first generated question to primary priority", () => {
    expect(selectNextQuestionCandidates(context, []).map((question) => question.id)).toEqual([
      "q_priority",
    ]);
  });

  it("makes the next candidates depend on the previous answer", () => {
    const candidates = selectNextQuestionCandidates(context, [
      { questionId: "q_priority", optionIds: ["priority_value"] },
    ]);
    expect(candidates.some((question) => question.id === "q_tradeoff_value")).toBe(true);
    expect(candidates.some((question) => question.id === "q_tradeoff_location")).toBe(false);
  });

  it("drops invented questions and options before scoring", () => {
    expect(normalizeTravelerAnswers([
      { questionId: "made_up", optionIds: ["quality_plus_999"] },
      { questionId: "q_priority", optionIds: ["made_up", "priority_quality"] },
    ])).toEqual([
      { questionId: "q_priority", optionIds: ["priority_quality"] },
    ]);
  });
});
