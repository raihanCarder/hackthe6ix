"use client";

import { useEffect, useRef, useState } from "react";

interface Settings {
  numberOfKids: number;
  homeCity: string | null;
  defaultAdults: number;
}

interface CitySuggestion {
  id: number;
  label: string;
}

const field =
  "w-full rounded border border-chalk/25 bg-pitch-950 px-3 py-2 text-chalk placeholder:text-chalk-dim/60";

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
      <p className="eyebrow">Manager settings</p>
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
          <button type="submit" disabled={busy} className="btn-gold w-full rounded-lg px-6 py-3">
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
    </div>
  );
}
