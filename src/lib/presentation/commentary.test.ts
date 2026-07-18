import { describe, expect, it } from "vitest";
import { renderCommentary } from "./commentary";
import { commentaryRequestSchema } from "./cues";
import type { PresentationEvent } from "./types";

describe("presentation commentary", () => {
  const events: PresentationEvent[] = [
    {
      version: 1,
      id: "journey:welcome",
      kind: "journey.moment",
      moment: "welcome",
    },
    {
      version: 1,
      id: "cup:intro",
      kind: "competition.intro",
      competitionName: "Trip Cup",
      contenderCount: 16,
    },
    {
      version: 1,
      id: "cup:matchup",
      kind: "matchup.introduction",
      homeName: "Hotel Alpha",
      awayName: "Hotel Bravo",
    },
    {
      version: 1,
      id: "cup:advantage",
      kind: "hotel.advantage",
      hotelName: "Hotel Alpha",
      opponentName: "Hotel Bravo",
      metric: "location",
    },
    {
      version: 1,
      id: "cup:winner",
      kind: "match.winner",
      winnerName: "Hotel Alpha",
      loserName: "Hotel Bravo",
      winnerGoals: 2,
      loserGoals: 1,
    },
    {
      version: 1,
      id: "cup:champion",
      kind: "competition.champion",
      championName: "Hotel Alpha",
      competitionName: "Trip Cup",
    },
  ];

  it("renders every event deterministically", () => {
    for (const event of events) {
      expect(renderCommentary(event)).toBe(renderCommentary(event));
      expect(renderCommentary(event).length).toBeGreaterThan(20);
    }
  });

  it("uses the facts supplied by a structured event", () => {
    const winnerEvent = events.find((event) => event.kind === "match.winner");
    expect(winnerEvent).toBeDefined();
    const winner = renderCommentary(winnerEvent as PresentationEvent);
    expect(winner).toContain("Hotel Alpha");
    expect(winner).toContain("Hotel Bravo");
    expect(winner).toContain("2");
    expect(winner).toContain("1");
  });

  it("rejects client-authored hotel facts", () => {
    expect(() =>
      commentaryRequestSchema.parse({
        source: "tournament",
        tournamentId: "tournament-1",
        audio: false,
        cue: {
          kind: "match.winner",
          homeId: "hotel-a",
          awayId: "hotel-b",
          winnerName: "invented client value",
        },
      }),
    ).toThrow();
  });

  it("accepts only approved journey moments", () => {
    expect(
      commentaryRequestSchema.parse({
        source: "journey",
        audio: true,
        cue: { kind: "journey.moment", moment: "pack.reveal" },
      }),
    ).toMatchObject({ source: "journey", cue: { moment: "pack.reveal" } });

    expect(() =>
      commentaryRequestSchema.parse({
        source: "journey",
        cue: { kind: "journey.moment", moment: "say-any-client-text" },
      }),
    ).toThrow();
  });
});
