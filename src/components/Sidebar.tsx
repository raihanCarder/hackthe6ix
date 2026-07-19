"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { BrandLink } from "@/components/BrandLink";
import { PresentationMuteButton } from "@/components/PresentationCommentary";
import { SignInModal } from "@/components/SignInModal";
import type { Profile } from "@/lib/useCurrentUser";

interface NavItem {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: (props: { className?: string }) => React.ReactElement;
}

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="11" y="2.5" width="6.5" height="4" rx="1.2" />
      <rect x="11" y="9" width="6.5" height="8.5" rx="1.2" />
      <rect x="2.5" y="11.5" width="6.5" height="6" rx="1.2" />
    </svg>
  );
}

function IconTrip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 10 17.5 4l-3.4 13-3.6-5.4L2.5 10Z" />
    </svg>
  );
}

function IconPackLab({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M10 2.5 17 6l-7 3.5L3 6l7-3.5Z" />
      <path d="M3 6v8l7 3.5V9.5" />
      <path d="M17 6v8l-7 3.5" />
    </svg>
  );
}

function IconCollection({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4.5" width="9" height="12" rx="1.4" />
      <path d="M14.5 6 17 7v9l-2.5 1" />
    </svg>
  );
}

function IconRevenue({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 16.5V9M8 16.5V5M13 16.5v-8M17 16.5V3" />
    </svg>
  );
}

function IconCoins({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10" cy="5" rx="5.8" ry="2.5" />
      <path d="M4.2 5v4c0 1.4 2.6 2.5 5.8 2.5s5.8-1.1 5.8-2.5V5" />
      <path d="M4.2 9v4c0 1.4 2.6 2.5 5.8 2.5s5.8-1.1 5.8-2.5V9" />
      <path d="M8.5 5h3" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 2.5 4 17.5 16 10 4 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="m12.2 12.2 4.1 4.1" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard, match: (p) => p === "/dashboard" },
  { href: "/packs", label: "Pack Lab", icon: IconTrip, match: (p) => p.startsWith("/packs") },
  {
    href: "/pack-history",
    label: "Pack History",
    icon: IconPackLab,
    match: (p) => p.startsWith("/pack-history") || p.startsWith("/pack/"),
  },
  { href: "/collection", label: "Collection", icon: IconCollection, match: (p) => p.startsWith("/collection") },
  { href: "/revenue", label: "Revenue", icon: IconRevenue, match: (p) => p.startsWith("/revenue") },
  { href: "/coins", label: "Buy Coins", icon: IconCoins, match: (p) => p.startsWith("/coins") },
  {
    href: "/play",
    label: "Play",
    icon: IconPlay,
    match: (p) => p.startsWith("/play") || p.startsWith("/tournament") || p.startsWith("/duel"),
  },
];

export function Sidebar({
  profile,
  authMode,
  onAuthChanged,
}: {
  profile: Profile | null;
  authMode: "auth0" | "dev";
  onAuthChanged: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showSignIn, setShowSignIn] = useState(false);

  function requireAuth(href: string, event: React.MouseEvent) {
    if (profile) return;
    event.preventDefault();
    if (authMode === "auth0") {
      window.location.assign(`/auth/login?returnTo=${encodeURIComponent(href)}`);
    } else {
      setShowSignIn(true);
    }
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-chalk/10 bg-pitch-850/80 px-3 py-4 backdrop-blur md:flex">
        <BrandLink className="px-2" imageClassName="h-7 w-7" textClassName="text-[13px]" gapClassName="gap-1.5" />

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => requireAuth(item.href, event)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  active ? "bg-pitch-700 text-chalk" : "text-chalk-dim hover:bg-chalk/5 hover:text-chalk"
                }`}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4">
          {profile ? (
            <AccountMenu profile={profile} authMode={authMode} onSignedOut={onAuthChanged} />
          ) : (
            <button onClick={() => setShowSignIn(true)} className="btn-primary w-full rounded-lg px-4 py-2 text-sm">
              Sign in
            </button>
          )}
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-chalk/10 bg-pitch-850/95 py-2 backdrop-blur md:hidden">
        {[
          { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
          { href: "/packs", label: "Trip", icon: IconTrip },
          { href: "/collection", label: "Cards", icon: IconCollection },
          { href: profile ? "/settings" : "#", label: "Account", icon: IconRevenue },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={(event) => {
              if (item.label === "Account" && !profile) {
                event.preventDefault();
                setShowSignIn(true);
              } else {
                requireAuth(item.href, event);
              }
            }}
            className={`flex flex-col items-center gap-0.5 px-3 text-[10px] ${
              pathname === item.href ? "text-cyan-bright" : "text-chalk-dim"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSignedIn={() => {
            onAuthChanged();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

export function Topbar({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/packs?destination=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="flex items-center gap-3 border-b border-chalk/10 px-4 py-3 sm:px-6">
      <form onSubmit={submitSearch} className="hidden flex-1 sm:block">
        <div className="relative max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-dim/70" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search trips, cities, cards…"
            className="w-full rounded-lg border border-chalk/15 bg-pitch-950/60 py-1.5 pr-3 pl-9 text-sm text-chalk placeholder:text-chalk-dim/60"
          />
        </div>
      </form>
      <div className="ml-auto flex items-center gap-2">
        {profile && (
          <span className="font-score hidden rounded bg-pitch-800 px-2 py-1 text-xs text-gold-bright sm:inline">
            {profile.currency} coins
          </span>
        )}
        {profile && <PresentationMuteButton compact />}
      </div>
    </div>
  );
}
