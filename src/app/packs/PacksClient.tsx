"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JourneyCommentaryCue, usePresentation } from "@/components/PresentationCommentary";
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
  const [summary, setSummary] = useState<SearchSummary | null>(null);
  const [busy, setBusy] = useState<"search" | "pack" | null>(null);
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
    setSummary(null);
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
    setSummary(null);
    setError(null);
  }

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!pack) return;
    setBusy("search");
    setError(null);
    setSummary(null);
    announce({ source: "journey", cue: { kind: "journey.moment", moment: "search.started" } });
    try {
      const response = await fetch("/api/search", {
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Search failed");
      setSummary(data);
      announce({ source: "journey", cue: { kind: "journey.moment", moment: "search.complete" } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(null);
    }
  }

  async function openPack() {
    if (!summary) return;
    setBusy("pack");
    setError(null);
    announce({ source: "journey", cue: { kind: "journey.moment", moment: "pack.opening" } });
    try {
      const response = await fetch("/api/packs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId: summary.searchId, scope: summary.scope }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Pack opening failed");
      void refresh();
      router.push(`/pack/${data.packId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pack opening failed");
      setBusy(null);
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

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <motion.button
            whileHover={{ y: -4 }}
            onClick={() => choosePack("trip")}
            className="panel rounded-2xl border-2 border-cyan-bright/40 p-8 text-left transition hover:border-cyan-bright"
          >
            <p className="eyebrow">Your trip</p>
            <h2 className="font-display mt-2 text-2xl text-chalk">Trip Pack</h2>
            <p className="mt-3 text-sm text-chalk-dim">
              Built from your real trip — pick a destination, dates, and party size. Five cards,
              all bookable for that stay. First pack per city is free.
            </p>
            <span className="btn-primary mt-6 inline-block rounded-lg px-6 py-2.5">Create first trip pack</span>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            onClick={() => choosePack("global")}
            className="panel rounded-2xl border-2 border-gold-bright/40 p-8 text-left transition hover:border-gold-bright"
          >
            <p className="eyebrow">Surprise me</p>
            <h2 className="font-display mt-2 text-2xl text-chalk">Global Pack</h2>
            <p className="mt-3 text-sm text-chalk-dim">
              A random destination from around the world — every continent in play. Five cards
              for the surprise city and dates you choose.
            </p>
            <span className="btn-gold mt-6 inline-block rounded-lg px-6 py-2.5">Choose Global Pack</span>
          </motion.button>
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

      <form onSubmit={runSearch} className="panel mt-6 grid gap-4 rounded-xl p-6 sm:grid-cols-2">
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
          <button type="submit" disabled={busy !== null} className="btn-primary w-full rounded-lg px-6 py-3">
            {busy === "search"
              ? "Scanning live inventory…"
              : pack === "trip"
                ? "Scan the field"
                : "Draw a destination"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error} {error.includes("Sign in") && "— use the Sign in button in the sidebar."}
        </div>
      )}

      {summary && (
        <div className="panel mt-6 rounded-xl p-6">
          <p className="eyebrow">Live inventory · {summary.destination.label}</p>
          <p className="font-score mt-2 text-2xl text-chalk">
            {summary.eligibleCount}{" "}
            <span className="text-sm text-chalk-dim">
              bookable contenders (of {summary.totalResults} found
              {summary.mode === "mock" ? " · demo data — add STAY22_API_KEY for live" : " · live Stay22"}
              )
            </span>
          </p>
          <button
            onClick={openPack}
            disabled={busy !== null}
            className="btn-primary mt-4 w-full rounded-lg px-6 py-3 text-lg"
          >
            {busy === "pack"
              ? "Minting trip pack…"
              : summary.freePackAvailable
                ? "Mint your free trip pack"
                : `Mint a ${pack === "trip" ? "Trip" : "Global"} Pack · ${summary.packCost} coins`}
          </button>
        </div>
      )}
    </div>
  );
}
