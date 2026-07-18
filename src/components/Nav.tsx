"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  currentWinStreak: number;
  bestWinStreak: number;
  currency: number;
  xp: number;
  level: number;
  packsOpened: number;
  matchesPlayed: number;
  mvpCount: number;
}

export function Nav() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<"auth0" | "dev">("dev");
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/me");
    if (!response.ok) return;
    const data = await response.json();
    setProfile(data.user);
    setAuthMode(data.authMode);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  async function devLogin(event: React.FormEvent) {
    event.preventDefault();
    if (username.trim().length < 2) return;
    setBusy(true);
    try {
      const response = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (response.ok) {
        setShowLogin(false);
        setUsername("");
        await refresh();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (authMode === "auth0") {
      window.location.href = "/auth/logout";
      return;
    }
    await fetch("/api/dev/logout", { method: "POST" });
    setProfile(null);
    router.push("/");
    router.refresh();
  }

  const links = [
    { href: "/search", label: "New trip" },
    { href: "/collection", label: "Collection" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <header className="sticky top-0 z-40 panel border-x-0 border-t-0">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-sm leading-tight tracking-tight sm:text-base">
          <span className="text-turf-bright">CHECK-IN</span>{" "}
          <span className="text-gold-bright">CHAMPIONS</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {profile &&
            links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-2 py-1.5 text-xs sm:px-3 sm:text-sm ${
                  pathname.startsWith(link.href)
                    ? "bg-pitch-700 text-chalk"
                    : "text-chalk-dim hover:text-chalk"
                }`}
              >
                {link.label}
              </Link>
            ))}

          {profile ? (
            <div className="ml-1 flex items-center gap-2 sm:ml-3 sm:gap-3">
              <span className="font-score rounded bg-pitch-800 px-2 py-1 text-xs text-gold-bright">
                {profile.currency} coins
              </span>
              <span className="font-score hidden rounded bg-pitch-800 px-2 py-1 text-xs text-chalk sm:inline">
                LV {profile.level}
              </span>
              <button
                onClick={logout}
                className="btn-chalk rounded px-2 py-1 text-xs"
                title={`Signed in as ${profile.username}`}
              >
                Sign out
              </button>
            </div>
          ) : authMode === "auth0" ? (
            <a href="/auth/login" className="btn-gold rounded px-4 py-1.5 text-sm">
              Sign in
            </a>
          ) : (
            <button onClick={() => setShowLogin(true)} className="btn-gold rounded px-4 py-1.5 text-sm">
              Sign in
            </button>
          )}
        </nav>
      </div>

      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowLogin(false)}
        >
          <form
            onSubmit={devLogin}
            onClick={(event) => event.stopPropagation()}
            className="panel w-full max-w-sm rounded-xl p-6"
          >
            <p className="eyebrow">Team sheet</p>
            <h2 className="font-display mt-1 text-xl">Enter the dugout</h2>
            <p className="mt-2 text-sm text-chalk-dim">
              Local demo sign-in. Connect an Auth0 tenant in .env for real accounts.
            </p>
            <input
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Manager name"
              className="mt-4 w-full rounded border border-chalk/25 bg-pitch-950 px-3 py-2 text-chalk placeholder:text-chalk-dim/60"
              minLength={2}
              maxLength={32}
              required
            />
            <button type="submit" disabled={busy} className="btn-gold mt-4 w-full rounded px-4 py-2">
              {busy ? "Warming up…" : "Sign in"}
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
