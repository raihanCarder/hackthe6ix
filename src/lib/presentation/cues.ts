import { z } from "zod";

const matchCueFields = {
  homeId: z.string().min(1).max(300),
  awayId: z.string().min(1).max(300),
};

export const commentaryRequestSchema = z.object({
  tournamentId: z.string().min(1).max(100),
  audio: z.boolean().default(false),
  cue: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("competition.intro") }).strict(),
    z.object({ kind: z.literal("matchup.introduction"), ...matchCueFields }).strict(),
    z.object({ kind: z.literal("match.winner"), ...matchCueFields }).strict(),
    z.object({
      kind: z.literal("hotel.advantage"),
      advantageIndex: z.number().int().min(0).max(2),
    }).strict(),
    z.object({ kind: z.literal("competition.champion") }).strict(),
  ]),
}).strict();
