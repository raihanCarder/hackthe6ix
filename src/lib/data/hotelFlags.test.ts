import { describe, expect, it } from "vitest";
import { resolveHotelFlag } from "./hotelFlags";

describe("hotel flag resolution", () => {
  it("uses an explicit country code first", () => {
    expect(resolveHotelFlag({ countryCode: "ca", countryName: "Canada" })).toEqual({
      src: "/flags/CA.svg",
      alt: "Canada flag",
    });
  });

  it("infers a flag from old saved-card addresses", () => {
    expect(resolveHotelFlag({ address: "L4J 7S9, Canada" })).toEqual({
      src: "/flags/CA.svg",
      alt: "Canada flag",
    });
  });

  it("returns null when no country can be inferred", () => {
    expect(resolveHotelFlag({ address: "Location unavailable" })).toBeNull();
  });
});
