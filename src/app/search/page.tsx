"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SearchSummary {
  searchId: string;
  mode: "live" | "mock";
  destination: { label: string };
  totalResults: number;
  eligibleCount: number;
  freePackAvailable: boolean;
  packCost: number;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SearchPage() {
  const router = useRouter();
  const today = new Date();
  const [form, setForm] = useState({
    destination: "Toronto",
    checkin: addDays(today, 21),
    checkout: addDays(today, 24),
    adults: 2,
    children: 0,
    rooms: 1,
    maxNightly: "" as string,
  });
  const [summary, setSummary] = useState<SearchSummary | null>(null);
  const [busy, setBusy] = useState<"search" | "pack" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        if (!settings) return;
        setForm((prev) => ({
          ...prev,
          adults: settings.defaultAdults ?? prev.adults,
          children: settings.numberOfKids ?? prev.children,
        }));
      });
  }, []);

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setBusy("search");
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: form.destination,
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
    try {
      const response = await fetch("/api/packs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId: summary.searchId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Pack opening failed");
      router.push(`/pack/${data.packId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pack opening failed");
      setBusy(null);
    }
  }

  const field =
    "w-full rounded border border-chalk/25 bg-pitch-950 px-3 py-2 text-chalk placeholder:text-chalk-dim/60";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Fixture setup</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">Where&apos;s the away game?</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Real trip inputs drive a live accommodation search — every card in your pack is bookable
        for these dates.
      </p>

      <form onSubmit={runSearch} className="panel mt-6 grid gap-4 rounded-xl p-6 sm:grid-cols-2">
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
          <button type="submit" disabled={busy !== null} className="btn-gold w-full rounded-lg px-6 py-3">
            {busy === "search" ? "Scouting live hotels…" : "Scout the field"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error} {error.includes("Sign in") && "— use the Sign in button in the top bar."}
        </div>
      )}

      {summary && (
        <div className="panel mt-6 rounded-xl p-6">
          <p className="eyebrow">Scouting report · {summary.destination.label}</p>
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
            className="btn-gold mt-4 w-full rounded-lg px-6 py-3 text-lg"
          >
            {busy === "pack"
              ? "Tearing the foil…"
              : summary.freePackAvailable
                ? "Open your free Trip Pack"
                : `Open a Trip Pack · ${summary.packCost} coins`}
          </button>
        </div>
      )}
    </div>
  );
}
