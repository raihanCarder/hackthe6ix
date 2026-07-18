import "server-only";
import type { ElevenLabsConfig } from "./config";

const API_BASE = "https://api.elevenlabs.io/v1";

interface SubscriptionPayload {
  character_count?: number;
  character_limit?: number;
  max_credit_limit_extension?: number | "unlimited";
}

export async function getSubscriptionAllowance(config: ElevenLabsConfig): Promise<number> {
  const response = await fetch(`${API_BASE}/user/subscription`, {
    headers: { "xi-api-key": config.apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`ElevenLabs subscription check failed (${response.status})`);
  const subscription = (await response.json()) as SubscriptionPayload;
  if (
    typeof subscription.character_count !== "number" ||
    typeof subscription.character_limit !== "number"
  ) {
    throw new Error("ElevenLabs subscription response did not include usage limits");
  }
  const extension =
    subscription.max_credit_limit_extension === "unlimited"
      ? Number.POSITIVE_INFINITY
      : (subscription.max_credit_limit_extension ?? 0);
  return subscription.character_limit + extension - subscription.character_count;
}

export async function synthesizeSpeech(
  config: ElevenLabsConfig,
  text: string,
): Promise<Uint8Array> {
  const endpoint = new URL(`${API_BASE}/text-to-speech/${encodeURIComponent(config.voiceId)}`);
  endpoint.searchParams.set("output_format", config.outputFormat);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": config.apiKey,
    },
    body: JSON.stringify({ text, model_id: config.modelId }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`ElevenLabs speech generation failed (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}
