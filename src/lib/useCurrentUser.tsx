"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
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

interface CurrentUserPayload {
  user: Profile | null;
  authMode: "auth0" | "dev";
}

async function fetchCurrentUser(): Promise<CurrentUserPayload | null> {
  const response = await fetch("/api/me");
  if (!response.ok) return null;
  return response.json();
}

interface CurrentUserState {
  profile: Profile | null;
  authMode: "auth0" | "dev";
  loaded: boolean;
  refresh: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
}

function useProvideCurrentUser(): CurrentUserState {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<"auth0" | "dev">("dev");
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const data = await fetchCurrentUser();
    if (!data) return;
    setProfile(data.user);
    setAuthMode(data.authMode);
  }

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser().then((data) => {
      if (!data || cancelled) return;
      setProfile(data.user);
      setAuthMode(data.authMode);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, authMode, loaded, refresh, setProfile };
}

const CurrentUserContext = createContext<CurrentUserState | null>(null);

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const value = useProvideCurrentUser();
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserState {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  return ctx;
}
