"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { SignInModal } from "@/components/SignInModal";
import { Sidebar, Topbar } from "@/components/Sidebar";
import {
  JourneyCommentaryCue,
  PresentationMuteButton,
} from "@/components/PresentationCommentary";
import { CurrentUserProvider, useCurrentUser, type Profile } from "@/lib/useCurrentUser";

function MarketingHeader({
  profile,
  authMode,
  onAuthChanged,
}: {
  profile: Profile | null;
  authMode: "auth0" | "dev";
  onAuthChanged: () => void;
}) {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-chalk/10 bg-pitch-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-display text-sm leading-tight tracking-tight sm:text-base"
        >
          <span className="text-cyan-bright">CHECK-IN CHAMPIONS</span>
        </Link>

        <nav className="ml-auto flex items-center gap-4">
          {profile && (
            <Link
              href="/dashboard"
              className="text-sm text-chalk-dim hover:text-chalk"
            >
              Dashboard
            </Link>
          )}
          {profile ? (
            <>
              <span className="font-score hidden rounded bg-pitch-800 px-2 py-1 text-xs text-gold-bright sm:inline">
                {profile.currency} coins
              </span>
              <PresentationMuteButton />
              <AccountMenu
                profile={profile}
                authMode={authMode}
                onSignedOut={onAuthChanged}
                placement="down"
              />
            </>
          ) : authMode === "auth0" ? (
            <a
              href="/auth/login"
              className="btn-primary rounded-lg px-4 py-1.5 text-sm"
            >
              Sign in
            </a>
          ) : (
            <button
              onClick={() => setShowSignIn(true)}
              className="btn-primary rounded-lg px-4 py-1.5 text-sm"
            >
              Sign in
            </button>
          )}
        </nav>
      </div>
      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSignedIn={onAuthChanged}
        />
      )}
    </header>
  );
}

export function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <ChromeInner>{children}</ChromeInner>
    </CurrentUserProvider>
  );
}

function ChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, authMode, refresh } = useCurrentUser();
  const isMarketing = pathname === "/";
  const authChanged = () => void refresh();

  if (isMarketing) {
    return (
      <div className="flex min-h-screen flex-col">
        <MarketingHeader
          profile={profile}
          authMode={authMode}
          onAuthChanged={authChanged}
        />
        {profile && <JourneyCommentaryCue moment="welcome" />}
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:pl-56">
      <Sidebar
        profile={profile}
        authMode={authMode}
        onAuthChanged={authChanged}
      />
      <div className="flex min-h-screen flex-col">
        <Topbar profile={profile} />
        {profile && <JourneyCommentaryCue moment="welcome" />}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
