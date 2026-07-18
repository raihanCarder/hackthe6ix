"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignInModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

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
        onSignedIn();
        onClose();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={devLogin}
        onClick={(event) => event.stopPropagation()}
        className="panel w-full max-w-sm rounded-xl p-6"
      >
        <p className="eyebrow">Local demo</p>
        <h2 className="font-display mt-1 text-xl text-chalk">Sign in</h2>
        <p className="mt-2 text-sm text-chalk-dim">
          Local demo sign-in. Connect an Auth0 tenant in .env for real accounts.
        </p>
        <input
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Your name"
          className="mt-4 input-field"
          minLength={2}
          maxLength={32}
          required
        />
        <button type="submit" disabled={busy} className="btn-primary mt-4 w-full rounded-lg px-4 py-2">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
