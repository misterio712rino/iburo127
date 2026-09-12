"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const SIGN_OUT_FAILURE_MESSAGE = "Не удалось завершить сеанс. Попробуйте ещё раз.";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setStatus(null);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        setStatus(SIGN_OUT_FAILURE_MESSAGE);
        return;
      }

      router.replace("/auth/sign-in");
      router.refresh();
    } catch {
      setStatus(SIGN_OUT_FAILURE_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        aria-busy={pending}
        className="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Выходим…" : "Выйти"}
      </button>
      {status ? (
        <p role="alert" className="text-xs font-medium leading-5 text-[#7B2330]">
          {status}
        </p>
      ) : null}
    </div>
  );
}
