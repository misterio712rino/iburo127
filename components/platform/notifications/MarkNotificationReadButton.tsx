"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";

export function MarkNotificationReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function markRead() {
    if (pending) return;
    setPending(true);
    setError(false);

    try {
      const response = await fetch(`/api/platform/notifications/${encodeURIComponent(notificationId)}/read`, {
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
    <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3" aria-busy={pending}>
      <button
        type="button"
        onClick={markRead}
        disabled={pending}
        className="inline-flex min-h-11 w-full max-w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Check className="size-4 shrink-0" aria-hidden="true" />
        {pending ? "Сохраняем…" : "Отметить прочитанным"}
      </button>
      {error ? <span role="alert" className="min-w-0 break-words text-xs font-semibold text-red-700">Не удалось обновить уведомление.</span> : null}
    </div>
  );
}
