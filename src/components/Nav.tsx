"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

async function fetchCurrentUser(): Promise<{ user: Profile | null; authMode: "auth0" | "dev" } | null> {
  const response = await fetch("/api/me");
  if (!response.ok) return null;
  return response.json();
}

export function Nav() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<"auth0" | "dev">("dev");
  const [showLogin, setShowLogin] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState<{ open: boolean; pathname: string | null }>({
    open: false,
    pathname: null,
  });
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const showSettings = settingsMenu.open && settingsMenu.pathname === pathname;

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser().then((data) => {
      if (!data || cancelled) return;
      setProfile(data.user);
      setAuthMode(data.authMode);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!showSettings) return;

    function handlePointerDown(event: PointerEvent) {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsMenu({ open: false, pathname: null });
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsMenu({ open: false, pathname: null });
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSettings]);

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
        const data = await fetchCurrentUser();
        if (data) {
          setProfile(data.user);
          setAuthMode(data.authMode);
        }
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
              <div ref={settingsRef} className="relative">
                <button
                  onClick={() =>
                    setSettingsMenu((menu) => ({
                      open: !(menu.open && menu.pathname === pathname),
                      pathname,
                    }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded text-chalk-dim transition-colors hover:bg-chalk/10 hover:text-chalk"
                  title={`Settings for ${profile.username}`}
                  aria-label={`Open settings for ${profile.username}`}
                  aria-haspopup="menu"
                  aria-expanded={showSettings}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  >
                    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 .9-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5.9h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                  </svg>
                </button>

                {showSettings && (
                  <div
                    className="panel absolute right-0 mt-2 w-44 rounded p-2 shadow-2xl shadow-black/40"
                    role="menu"
                  >
                    <div className="border-b border-chalk/10 px-2 pb-2">
                      <p className="text-[0.65rem] uppercase text-chalk-dim">Signed in as</p>
                      <p className="truncate text-sm text-chalk">{profile.username}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="mt-2 w-full rounded px-2 py-2 text-left text-sm text-chalk-dim hover:bg-chalk/10 hover:text-chalk"
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
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
