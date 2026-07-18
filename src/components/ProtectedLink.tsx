"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface AuthPayload {
  authMode: "auth0" | "dev";
  user: unknown | null;
}

interface ProtectedLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
}

async function fetchAuth(): Promise<AuthPayload | null> {
  const response = await fetch("/api/me");
  if (!response.ok) return null;
  return response.json();
}

export function ProtectedLink({ children, className, href }: ProtectedLinkProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function navigate(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    const auth = await fetchAuth();

    if (auth?.user) {
      router.push(href);
      return;
    }

    if (auth?.authMode === "auth0") {
      window.location.assign(`/auth/login?returnTo=${encodeURIComponent(href)}`);
      return;
    }

    router.push(href);
  }

  return (
    <a href={href} onClick={navigate} className={className} aria-busy={busy}>
      {children}
    </a>
  );
}
