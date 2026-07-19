"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { SignInModal } from "@/components/SignInModal";
import { Sidebar, Topbar } from "@/components/Sidebar";
import { useCurrentUser } from "@/lib/useCurrentUser";

const FOOTER = (
  <footer className="px-6 py-8 text-center text-xs text-chalk-dim">
    Check-In Champions · Hack the 6ix · powered by live Stay22 data — the champion is a real,
    bookable recommendation.
  </footer>
);

function MarketingHeader() {
  const { profile, authMode, refresh } = useCurrentUser();
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-chalk/10 bg-pitch-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-sm leading-tight tracking-tight sm:text-base">
          <span className="text-cyan-bright">CHECK-IN CHAMPIONS</span>
        </Link>

        <nav className="ml-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
            Game loop
          </Link>
          {profile ? (
            <AccountMenu profile={profile} authMode={authMode} onSignedOut={refresh} />
          ) : authMode === "auth0" ? (
            <a href="/auth/login" className="btn-primary rounded-lg px-4 py-1.5 text-sm">
              Sign in
            </a>
          ) : (
            <button onClick={() => setShowSignIn(true)} className="btn-primary rounded-lg px-4 py-1.5 text-sm">
              Sign in
            </button>
          )}
        </nav>
      </div>
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} onSignedIn={refresh} />}
    </header>
  );
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, authMode } = useCurrentUser();
  const isMarketing = pathname === "/";

  if (isMarketing) {
    return (
      <div className="flex min-h-screen flex-col">
        <MarketingHeader />
        <main className="flex-1 pb-36">{children}</main>
        {FOOTER}
      </div>
    );
  }

  return (
    <div className="min-h-screen md:pl-56">
      <Sidebar profile={profile} authMode={authMode} />
      <div className="flex min-h-screen flex-col pb-14 md:pb-0">
        <Topbar profile={profile} />
        <main className="flex-1 pb-40">{children}</main>
        {FOOTER}
      </div>
    </div>
  );
}
