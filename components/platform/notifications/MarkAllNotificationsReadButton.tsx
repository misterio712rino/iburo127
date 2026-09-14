"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkAllNotificationsReadButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function markAllRead() {
    if (pending) return;
    setPending(true);
    setError(false);

    try {
      const response = await fetch("/api/platform/notifications/read-all", {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        setError(true);
        return;
      }

      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end" aria-busy={pending}>
      <button
        type="button"
        onClick={markAllRead}
        disabled={pending}
        className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/6 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary/25 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCheck className="size-4 shrink-0" aria-hidden="true" />
        {pending ? "Отмечаем…" : "Отметить все прочитанными"}
      </button>
      {error ? (
        <span role="alert" className="max-w-full break-words text-xs font-semibold text-red-700">
          Не удалось отметить уведомления прочитанными.
        </span>
      ) : null}
    </div>
  );
}
