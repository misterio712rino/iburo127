"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign("/auth/sign-in");
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Выходим…" : "Выйти"}
    </button>
  );
}
