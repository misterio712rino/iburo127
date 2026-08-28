"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={markRead}
        disabled={pending}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Отметить прочитанным"}
      </button>
      {error ? <span className="text-xs font-semibold text-red-700">Не удалось обновить уведомление.</span> : null}
    </div>
  );
}
