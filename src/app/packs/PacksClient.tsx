"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JourneyCommentaryCue, usePresentation } from "@/components/PresentationCommentary";
import { PACK_COST } from "@/lib/game/economy";
import { useCurrentUser } from "@/lib/useCurrentUser";

type PackKind = "trip" | "global";

interface SearchSummary {
  searchId: string;
  scope: PackKind;
  mode: "live" | "mock";
  destination: { label: string };
  totalResults: number;
  eligibleCount: number;
  freePackAvailable: boolean;
  packCost: number;
}

interface UserSettings {
  defaultAdults: number;
  numberOfKids: number;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PacksClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { announce } = usePresentation();
  const { refresh } = useCurrentUser();
  const today = new Date();
  const prefilledDestination = searchParams.get("destination");
  const [pack, setPack] = useState<PackKind | null>(prefilledDestination ? "trip" : null);
  const [form, setForm] = useState({
    destination: prefilledDestination ?? "Toronto",
    checkin: searchParams.get("checkin") ?? addDays(today, 21),
    checkout: searchParams.get("checkout") ?? addDays(today, 24),
    adults: 2,
    children: 0,
    rooms: 1,
    maxNightly: "" as string,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: unknown | null; authMode: "auth0" | "dev" } | null) => {
        if (!cancelled && data?.authMode === "auth0" && !data.user) {
          window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/packs")}`);
        }
      })
      .catch(() => undefined);

    fetch("/api/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: UserSettings | null) => {
        if (cancelled || !settings) return;
        setForm((previous) => ({
          ...previous,
          adults: settings.defaultAdults ?? previous.adults,
          children: settings.numberOfKids ?? previous.children,
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  function choosePack(kind: PackKind) {
    setPack(kind);
    setError(null);
    announce({
      source: "journey",
      cue: {
        kind: "journey.moment",
        moment: kind === "trip" ? "pack.trip_selected" : "pack.global_selected",
      },
    });
  }

  function backToChoose() {
    setPack(null);
    setError(null);
  }

  // One click: run the live inventory search, then immediately open the pack.
  async function openPackFlow(event: React.FormEvent) {
    event.preventDefault();
    if (!pack) return;
    setBusy(true);
    setError(null);
    announce({ source: "journey", cue: { kind: "journey.moment", moment: "search.started" } });
    try {
      const searchResponse = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: pack,
          destination: pack === "trip" ? form.destination : undefined,
          checkin: form.checkin,
          checkout: form.checkout,
          adults: form.adults,
          children: form.children,
          rooms: form.rooms,
          maxNightly: form.maxNightly ? Number(form.maxNightly) : null,
        }),
      });
      const search: SearchSummary = await searchResponse.json();
      if (!searchResponse.ok) {
        throw new Error((search as { error?: string }).error ?? "Search failed");
      }
      announce({ source: "journey", cue: { kind: "journey.moment", moment: "search.complete" } });

      announce({ source: "journey", cue: { kind: "journey.moment", moment: "pack.opening" } });
      const openResponse = await fetch("/api/packs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId: search.searchId, scope: search.scope ?? pack }),
      });
      const opened = await openResponse.json();
      if (!openResponse.ok) throw new Error(opened.error ?? "Pack opening failed");
      void refresh();
      // Carry the live-inventory count to the reveal page so the signal isn't lost.
      const params = new URLSearchParams({
        found: String(search.eligibleCount),
        total: String(search.totalResults),
      });
      router.push(`/pack/${opened.packId}?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pack opening failed");
      setBusy(false);
    }
  }

  const field = "input-field";

  if (!pack) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <JourneyCommentaryCue moment="pack.selection" />
        <p className="eyebrow text-center">New trip · pack selection</p>
        <h1 className="font-display mt-2 text-center text-3xl text-chalk sm:text-4xl">
          Build the booking game from your first search.
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-chalk-dim">
          No trip packs yet. Enter a destination and let live Stay22 inventory become cards,
          scores, collection progress, and a real checkout path.
        </p>

        <div className="mx-auto mt-12 grid max-w-2xl gap-8 sm:grid-cols-2">
          <div className="foil-pack-slot foil-pack-trip">
            <motion.button
              whileHover={{ scale: 1.05, y: -6 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              onClick={() => choosePack("trip")}
              className="foil-pack"
              aria-label="Choose Trip Pack"
            >
              <span className="foil-pack-crimp" aria-hidden />
              <span className="foil-pack-crimp foil-pack-crimp-bottom" aria-hidden />
              <span className="card-sheen pointer-events-none absolute inset-0 z-0" aria-hidden />
              <div className="relative z-[1] flex justify-center">
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="foil-pack-emblem"
                  aria-hidden
                >
                  <path d="M24 8c-5 0-9 3.8-9 9 0 6.4 9 15 9 15s9-8.6 9-15c0-5.2-4-9-9-9Z" />
                  <circle cx="24" cy="17" r="3.4" fill="currentColor" stroke="none" />
                  <path d="M8 40C16 33 32 33 40 40" strokeDasharray="1.5 3.5" />
                  <circle cx="8" cy="40" r="1.7" fill="currentColor" stroke="none" />
                  <circle cx="40" cy="40" r="1.7" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div className="relative z-[1] mt-auto">
                <p className="eyebrow">Your trip</p>
                <h2 className="foil-pack-title mt-1 text-2xl">Trip Pack</h2>
                <p className="foil-pack-desc mt-2 text-sm">
                  Built from your real trip — five bookable cards for your dates. First pack per
                  city is free.
                </p>
              </div>
            </motion.button>
            <p className="foil-pack-label">Choose Trip Pack</p>
          </div>

          <div className="foil-pack-slot foil-pack-global">
            <motion.button
              whileHover={{ scale: 1.05, y: -6 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              onClick={() => choosePack("global")}
              className="foil-pack"
              aria-label="Choose Global Pack"
            >
              <span className="foil-pack-crimp" aria-hidden />
              <span className="foil-pack-crimp foil-pack-crimp-bottom" aria-hidden />
              <span className="card-sheen pointer-events-none absolute inset-0 z-0" aria-hidden />
              <div className="relative z-[1] flex justify-center">
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="foil-pack-emblem"
                  aria-hidden
                >
                  <circle cx="24" cy="24" r="17" />
                  <ellipse cx="24" cy="24" rx="7" ry="17" />
                  <line x1="7" y1="24" x2="41" y2="24" />
                  <path d="M9.5 16H38.5" />
                  <path d="M9.5 32H38.5" />
                  <circle cx="30" cy="15" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="17" cy="28" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="28" cy="33" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div className="relative z-[1] mt-auto">
                <p className="eyebrow">Surprise me</p>
                <h2 className="foil-pack-title mt-1 text-2xl">Global Pack</h2>
                <p className="foil-pack-desc mt-2 text-sm">
                  A random destination from around the world — every continent in play. Five cards
                  for the surprise city.
                </p>
              </div>
            </motion.button>
            <p className="foil-pack-label">Choose Global Pack</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button onClick={backToChoose} className="text-xs text-chalk-dim underline-offset-2 hover:underline">
        ← Back to pack selection
      </button>

      <p className="eyebrow mt-4">Trip pack builder</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">
        {pack === "trip" ? "Kick off a trip" : "Roll the dice on a destination"}
      </h1>
      <p className="mt-2 text-sm text-chalk-dim">
        {pack === "trip"
          ? "Real trip inputs drive a live accommodation search — every card in your pack is bookable for these dates."
          : "We'll pick a random city from around the world. Set your dates and party, and let the draw decide the rest."}
      </p>

      <form onSubmit={openPackFlow} className="panel mt-6 grid gap-4 rounded-xl p-6 sm:grid-cols-2">
        {pack === "trip" && (
          <label className="sm:col-span-2">
            <span className="eyebrow">Destination</span>
            <input
              className={`${field} mt-1`}
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="Toronto, Montréal, Tokyo…"
              required
              minLength={2}
            />
          </label>
        )}
        <label>
          <span className="eyebrow">Check-in</span>
          <input
            type="date"
            className={`${field} mt-1`}
            value={form.checkin}
            onChange={(e) => setForm({ ...form, checkin: e.target.value })}
            required
          />
        </label>
        <label>
          <span className="eyebrow">Checkout</span>
          <input
            type="date"
            className={`${field} mt-1`}
            value={form.checkout}
            onChange={(e) => setForm({ ...form, checkout: e.target.value })}
            required
          />
        </label>
        <label>
          <span className="eyebrow">Adults</span>
          <input
            type="number"
            min={1}
            max={16}
            className={`${field} mt-1`}
            value={form.adults}
            onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })}
          />
        </label>
        <label>
          <span className="eyebrow">Children</span>
          <input
            type="number"
            min={0}
            max={12}
            className={`${field} mt-1`}
            value={form.children}
            onChange={(e) => setForm({ ...form, children: Number(e.target.value) })}
          />
        </label>
        <label>
          <span className="eyebrow">Rooms</span>
          <input
            type="number"
            min={1}
            max={8}
            className={`${field} mt-1`}
            value={form.rooms}
            onChange={(e) => setForm({ ...form, rooms: Number(e.target.value) })}
          />
        </label>
        <label>
          <span className="eyebrow">Max $/night (optional)</span>
          <input
            type="number"
            min={1}
            className={`${field} mt-1`}
            value={form.maxNightly}
            onChange={(e) => setForm({ ...form, maxNightly: e.target.value })}
            placeholder="No cap"
          />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="btn-primary w-full rounded-lg px-6 py-3 text-lg">
            {busy
              ? "Opening pack…"
              : pack === "trip"
                ? "Open Trip Pack · first city free"
                : `Open Global Pack · ${PACK_COST} coins`}
          </button>
          <p className="mt-2 text-center text-xs text-chalk-dim">
            One tap runs a live inventory search and opens your pack.
          </p>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error} {error.includes("Sign in") && "— use the Sign in button in the sidebar."}
        </div>
      )}
    </div>
  );
}
