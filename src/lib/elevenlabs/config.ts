import "server-only";

const DEFAULT_MODEL = "eleven_flash_v2_5";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_MONTHLY_LIMIT = 10_000;
const DEFAULT_CREDIT_RESERVE = 1_000;

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  outputFormat: string;
  monthlyCharacterLimit: number;
  accountCreditReserve: number;
}

export function getElevenLabsConfig(): ElevenLabsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId) return null;

  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || DEFAULT_OUTPUT_FORMAT;
  if (!/^mp3_\d+_\d+$/.test(outputFormat)) {
    throw new Error("ELEVENLABS_OUTPUT_FORMAT must be an mp3 output format");
  }

  return {
    apiKey,
    voiceId,
    modelId: process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL,
    outputFormat,
    monthlyCharacterLimit: nonNegativeInteger(
      process.env.ELEVENLABS_MONTHLY_CHARACTER_LIMIT,
      DEFAULT_MONTHLY_LIMIT,
    ),
    accountCreditReserve: nonNegativeInteger(
      process.env.ELEVENLABS_ACCOUNT_CREDIT_RESERVE,
      DEFAULT_CREDIT_RESERVE,
    ),
  };
}
