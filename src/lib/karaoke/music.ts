import "server-only";
import type { KaraokeMusicConfig } from "./musicConfig";

const API_BASE = "https://api.elevenlabs.io/v1";

export async function composeSong(config: KaraokeMusicConfig, prompt: string): Promise<Uint8Array> {
  const endpoint = new URL(`${API_BASE}/music`);
  endpoint.searchParams.set("output_format", config.outputFormat);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": config.apiKey,
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: config.lengthMs,
      model_id: config.modelId,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`ElevenLabs music generation failed (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}
