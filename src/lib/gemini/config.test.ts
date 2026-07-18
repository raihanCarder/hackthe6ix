import { describe, expect, it } from "vitest";
import { geminiQuestionTimeoutMs } from "./config";

describe("Gemini questionnaire latency budget", () => {
  it("defaults to a short response window", () => {
    expect(geminiQuestionTimeoutMs(undefined)).toBe(1_800);
  });

  it("accepts a configured timeout inside the safe range", () => {
    expect(geminiQuestionTimeoutMs("1250")).toBe(1_250);
  });

  it("clamps extreme values", () => {
    expect(geminiQuestionTimeoutMs("100")).toBe(500);
    expect(geminiQuestionTimeoutMs("12000")).toBe(5_000);
  });
});
