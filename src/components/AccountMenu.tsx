"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/useCurrentUser";

export function AccountMenu({
  profile,
  authMode,
  onSignedOut,
  placement = "up",
}: {
  profile: Profile;
  authMode: "auth0" | "dev";
  onSignedOut: () => void;
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const menuPosition =
    placement === "down"
      ? "absolute top-full right-0 mt-2"
      : "absolute bottom-full left-0 mb-2";

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function logout() {
    if (authMode === "auth0") {
      window.location.href = "/auth/logout";
      return;
    }
    await fetch("/api/dev/logout", { method: "POST" });
    onSignedOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-chalk/10"
        title={`Account: ${profile.username}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch-700 font-display text-xs text-chalk">
          {profile.username.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-chalk">{profile.username}</span>
          <span className="font-score block text-[11px] text-chalk-dim">
            LV {profile.level} · {profile.currency} coins
          </span>
        </span>
      </button>

      {open && (
        <div
          className={`panel ${menuPosition} z-50 w-52 rounded-lg p-2 shadow-2xl shadow-black/40`}
          role="menu"
        >
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded px-2 py-2 text-left text-sm text-chalk-dim hover:bg-chalk/10 hover:text-chalk"
            role="menuitem"
          >
            Settings
          </Link>
          <button
            onClick={logout}
            className="mt-1 w-full rounded px-2 py-2 text-left text-sm text-chalk-dim hover:bg-chalk/10 hover:text-chalk"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
