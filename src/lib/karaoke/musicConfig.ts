import "server-only";

const DEFAULT_MODEL = "music_v1";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_LENGTH_MS = 12_000;
const MIN_LENGTH_MS = 3_000;
const MAX_LENGTH_MS = 600_000;
const DEFAULT_MONTHLY_LIMIT = 40;

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export interface KaraokeMusicConfig {
  apiKey: string;
  modelId: string;
  outputFormat: string;
  lengthMs: number;
  monthlyGenerationLimit: number;
}

export function getKaraokeMusicConfig(): KaraokeMusicConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;

  const outputFormat = process.env.ELEVENLABS_MUSIC_OUTPUT_FORMAT?.trim() || DEFAULT_OUTPUT_FORMAT;
  if (!/^mp3_\d+_\d+$/.test(outputFormat)) {
    throw new Error("ELEVENLABS_MUSIC_OUTPUT_FORMAT must be an mp3 output format");
  }

  const lengthMs = Math.min(
    MAX_LENGTH_MS,
    Math.max(MIN_LENGTH_MS, nonNegativeInteger(process.env.ELEVENLABS_MUSIC_LENGTH_MS, DEFAULT_LENGTH_MS)),
  );

  return {
    apiKey,
    modelId: process.env.ELEVENLABS_MUSIC_MODEL_ID?.trim() || DEFAULT_MODEL,
    outputFormat,
    lengthMs,
    monthlyGenerationLimit: nonNegativeInteger(
      process.env.ELEVENLABS_MUSIC_MONTHLY_LIMIT,
      DEFAULT_MONTHLY_LIMIT,
    ),
  };
}
