"use client";

import { useEffect, useState } from "react";

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

interface CurrentUserPayload {
  user: Profile | null;
  authMode: "auth0" | "dev";
}

async function fetchCurrentUser(): Promise<CurrentUserPayload | null> {
  const response = await fetch("/api/me");
  if (!response.ok) return null;
  return response.json();
}

export function useCurrentUser() {
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
