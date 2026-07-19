import { describe, expect, it } from "vitest";
import {
  countryFromName,
  inferCountryFromText,
  normalizeToken,
} from "./countries";

describe("country helpers", () => {
  it("maps common country names to ISO alpha-2 codes", () => {
    expect(countryFromName("Canada")).toMatchObject({ code: "CA" });
    expect(countryFromName("United States")).toMatchObject({ code: "US" });
    expect(countryFromName("United Kingdom")).toMatchObject({ code: "GB" });
    expect(countryFromName("Czechia")).toMatchObject({ code: "CZ" });
    expect(countryFromName("South Korea")).toMatchObject({ code: "KR" });
  });

  it("infers country from destination text and known cities", () => {
    expect(inferCountryFromText("Toronto, Canada")).toMatchObject({ code: "CA" });
    expect(inferCountryFromText("Prague")).toMatchObject({ code: "CZ" });
    expect(inferCountryFromText("Seoul")).toMatchObject({ code: "KR" });
    expect(inferCountryFromText("London, UK")).toMatchObject({ code: "GB" });
  });

  it("returns null for unknown destinations", () => {
    expect(inferCountryFromText("Atlantis")).toBeNull();
  });

  it("normalizes accents and punctuation", () => {
    expect(normalizeToken("Montréal, Québec")).toBe("montreal quebec");
  });
});
