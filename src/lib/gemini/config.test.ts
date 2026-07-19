import { describe, expect, it } from "vitest";
import { geminiQuestionTimeoutMs, geminiRecapTimeoutMs } from "./config";

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

describe("Gemini recap latency budget", () => {
  it("defaults to 3.5 seconds", () => {
    expect(geminiRecapTimeoutMs(undefined)).toBe(3_500);
  });

  it("clamps custom values", () => {
    expect(geminiRecapTimeoutMs("250")).toBe(1_000);
    expect(geminiRecapTimeoutMs("12000")).toBe(8_000);
  });
});
