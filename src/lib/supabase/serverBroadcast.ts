import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  client =
    url && serviceRoleKey
      ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
      : null;
  return client;
}

/**
 * Best-effort "a duel row changed" ping so both players' clients know to
 * refetch GET /api/duel/[id]. Missing Supabase config = silent no-op — the
 * client falls back to polling, so gameplay still works either way.
 */
export async function broadcastDuelChange(duelId: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const channel = supabase.channel(`duel:${duelId}`);
  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            reject(new Error(`realtime subscribe failed: ${status}`));
          }
        });
      }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    await channel.send({ type: "broadcast", event: "update", payload: {} });
  } catch (error) {
    console.error("broadcastDuelChange failed", error);
  } finally {
    await supabase.removeChannel(channel);
  }
}
