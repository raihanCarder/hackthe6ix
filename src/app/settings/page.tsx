"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface Settings {
  numberOfKids: number;
  homeCity: string | null;
  defaultAdults: number;
}

interface CitySuggestion {
  id: number;
  label: string;
}

const field = "input-field";

export default function SettingsPage() {
  const { setProfile } = useCurrentUser();
  const [form, setForm] = useState<Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onHomeCityChange(value: string) {
    setForm((prev) => (prev ? { ...prev, homeCity: value } : prev));
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const response = await fetch(`/api/cities/search?q=${encodeURIComponent(value)}`);
      if (!response.ok) return;
      const data = await response.json();
      setSuggestions(data.results ?? []);
      setShowSuggestions(true);
    }, 300);
  }

  function selectCity(label: string) {
    setForm((prev) => (prev ? { ...prev, homeCity: label } : prev));
    setSuggestions([]);
    setShowSuggestions(false);
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(setForm)
      .finally(() => setLoaded(true));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save settings");
      setForm(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  async function resetAccount(event: React.FormEvent) {
    event.preventDefault();
    if (resetPhrase !== "RESET") return;

    setResetBusy(true);
    setResetError(null);
    try {
      const response = await fetch("/api/account/reset", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not reset account");
      }

      setProfile(null);
      window.location.assign(data?.redirectTo ?? "/");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not reset account");
      setResetBusy(false);
    }
  }

  if (!loaded) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-chalk-dim">Loading settings…</div>;
  }
  if (!form) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-display text-xl text-chalk">You&apos;re not signed in.</p>
        <p className="mt-2 text-sm text-chalk-dim">Sign in from the top bar to manage your settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Account settings</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">Personal info</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Used to prefill your trip searches with the right party size.
      </p>

      <form onSubmit={save} className="panel mt-6 grid gap-4 rounded-xl p-6 sm:grid-cols-2">
        <label>
          <span className="eyebrow">Number of kids</span>
          <input
            type="number"
            min={0}
            max={20}
            className={`${field} mt-1`}
            value={form.numberOfKids}
            onChange={(e) => setForm({ ...form, numberOfKids: Number(e.target.value) })}
          />
        </label>
        <label>
          <span className="eyebrow">Default adults for trips</span>
          <input
            type="number"
            min={1}
            max={16}
            className={`${field} mt-1`}
            value={form.defaultAdults}
            onChange={(e) => setForm({ ...form, defaultAdults: Number(e.target.value) })}
          />
        </label>
        <label className="relative sm:col-span-2">
          <span className="eyebrow">Home city</span>
          <input
            className={`${field} mt-1`}
            value={form.homeCity ?? ""}
            onChange={(e) => onHomeCityChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Toronto, Montréal, Tokyo…"
            maxLength={80}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="panel absolute z-10 mt-1 w-full overflow-hidden rounded-lg">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={() => selectCity(s.label)}
                    className="block w-full px-3 py-2 text-left text-sm text-chalk hover:bg-pitch-700"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="btn-primary w-full rounded-lg px-6 py-3">
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error}
        </div>
      )}
      {saved && !error && <p className="mt-4 text-sm text-turf-bright">Settings saved.</p>}

      <section className="panel mt-6 rounded-xl border-whistle/30 p-6">
        <p className="eyebrow text-whistle">Account</p>
        <h2 className="font-display mt-2 text-xl text-chalk">Reset account</h2>
        <p className="mt-2 text-sm text-chalk-dim">
          This permanently removes your Check-In Champions data, including cards, packs,
          tournaments, searches, coin purchases, stats, and settings. Your Auth0 login is kept.
        </p>

        <form onSubmit={resetAccount} className="mt-5 grid gap-4">
          <label>
            <span className="eyebrow">Type RESET to confirm</span>
            <input
              className={`${field} mt-1`}
              value={resetPhrase}
              onChange={(e) => {
                setResetPhrase(e.target.value);
                setResetError(null);
              }}
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={resetBusy || resetPhrase !== "RESET"}
            className="w-full rounded-lg bg-whistle px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resetBusy ? "Resetting…" : "Reset account"}
          </button>
        </form>

        {resetError && (
          <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
            {resetError}
          </div>
        )}
      </section>
    </div>
  );
}
