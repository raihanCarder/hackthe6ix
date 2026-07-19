"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const POLL_INTERVAL_MS = 2000;

let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  client = url && anonKey ? createClient(url, anonKey) : null;
  return client;
}

/**
 * Live updates for a single duel: calls onChange whenever the server-side
 * broadcastDuelChange() ping arrives for this duel id. Falls back to plain
 * polling when Supabase Realtime isn't configured, so the duel still works
 * without any Supabase project wired up. Returns an unsubscribe function.
 */
export function subscribeToDuel(duelId: string, onChange: () => void): () => void {
  const supabase = getClient();
  if (!supabase) {
    const interval = setInterval(onChange, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }

  const channel = supabase
    .channel(`duel:${duelId}`)
    .on("broadcast", { event: "update" }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
