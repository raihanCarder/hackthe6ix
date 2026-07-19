import { z } from "zod";

const matchCueFields = {
  homeId: z.string().min(1).max(300),
  awayId: z.string().min(1).max(300),
};

const journeyMomentSchema = z.enum([
  "welcome",
  "pack.selection",
  "pack.trip_selected",
  "pack.global_selected",
  "search.started",
  "search.complete",
  "pack.opening",
  "pack.reveal",
  "pack.complete",
  "play.mode_selection",
  "play.trip_selected",
  "play.global_selected",
  "questionnaire.started",
  "questionnaire.answer",
  "tournament.simulating",
]);

const tournamentCueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("competition.intro") }).strict(),
  z.object({ kind: z.literal("matchup.introduction"), ...matchCueFields }).strict(),
  z.object({ kind: z.literal("match.winner"), ...matchCueFields }).strict(),
  z.object({
    kind: z.literal("match.goal"),
    ...matchCueFields,
    goalIndex: z.number().int().min(0).max(12),
  }).strict(),
  z.object({
    kind: z.literal("hotel.advantage"),
    advantageIndex: z.number().int().min(0).max(2),
  }).strict(),
  z.object({ kind: z.literal("competition.champion") }).strict(),
]);

export const commentaryRequestSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("journey"),
    audio: z.boolean().default(false),
    cue: z.object({ kind: z.literal("journey.moment"), moment: journeyMomentSchema }).strict(),
  }).strict(),
  z.object({
    source: z.literal("card"),
    cardId: z.string().min(1).max(100),
    audio: z.boolean().default(false),
    cue: z.object({ kind: z.literal("card.selection") }).strict(),
  }).strict(),
  z.object({
    source: z.literal("tournament"),
    tournamentId: z.string().min(1).max(100),
    audio: z.boolean().default(false),
    cue: tournamentCueSchema,
  }).strict(),
]);
