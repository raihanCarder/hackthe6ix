import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/engine/seed";
import { pickRandomCity, pickUniqueCountryCities, WORLD_CITIES } from "./worldCities";

describe("world city selection", () => {
  it("is reproducible for the same seed", () => {
    expect(pickRandomCity(createRng("same-seed"))).toEqual(
      pickRandomCity(createRng("same-seed")),
    );
  });

  it("returns the requested number of distinct countries", () => {
    const cities = pickUniqueCountryCities(createRng("world-cup"), 15);
    expect(cities).toHaveLength(15);
    expect(new Set(cities.map((city) => city.country)).size).toBe(15);
  });

  it("never returns more countries than the dataset contains", () => {
    const availableCountries = new Set(WORLD_CITIES.map((city) => city.country)).size;
    expect(pickUniqueCountryCities(createRng("all-countries"), 10_000)).toHaveLength(
      availableCountries,
    );
  });
});
