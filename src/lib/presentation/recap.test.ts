import { describe, expect, it } from "vitest";
import { validateGeneratedRecap, type TournamentRecapEvent } from "./recap";

const event: TournamentRecapEvent = {
  version: 1,
  id: "cup:recap",
  kind: "competition.recap",
  tournamentId: "tournament-1",
  competitionName: "Trip Cup",
  destinationLabel: "Toronto",
  championName: "Hotel Alpha",
  runnerUpName: "Hotel Bravo",
  championGoals: 2,
  runnerUpGoals: 1,
  championWins: 6,
  championMatches: 6,
  mainAdvantages: ["location", "value"],
  winProbabilityPercent: 68,
  personalized: true,
  userWon: true,
  rewardXp: 65,
  rewardCoins: 100,
};

describe("tournament recap grounding", () => {
  it("accepts prose made only from trusted tournament facts", () => {
    const recap = "Full time in Toronto. Hotel Alpha wins the Trip Cup, beating Hotel Bravo 2–1 in the final after 6 wins from 6 matches. The deterministic recommendation engine points to location and value as the decisive edge, with a 68% first-place probability and rewards of 65 XP and 100 coins.";
    expect(validateGeneratedRecap(recap, event)).toBe(recap);
  });

  it("rejects unsupported numbers", () => {
    const recap = "Hotel Alpha wins the Trip Cup over Hotel Bravo 2–1 in the final. The champion completed 99 matches, with location and value deciding a memorable tournament in Toronto for the recommendation engine.";
    expect(validateGeneratedRecap(recap, event)).toBeNull();
  });

  it("rejects invented hotel facts", () => {
    const recap = "Hotel Alpha wins the Trip Cup over Hotel Bravo 2–1 in the final. Its rooftop pool and breakfast made the difference throughout a memorable tournament in Toronto, while location and value completed the engine case.";
    expect(validateGeneratedRecap(recap, event)).toBeNull();
  });

  it("requires the exact finalists and final score", () => {
    const recap = "The Trip Cup reaches full time in Toronto after a memorable tournament. Hotel Alpha takes the trophy with location and value providing the recommendation engine's decisive edge throughout the competition.";
    expect(validateGeneratedRecap(recap, event)).toBeNull();
  });
});
