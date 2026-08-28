"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TaskStatus = "NEW" | "WORKING" | "DONE";

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  NEW: "WORKING",
  WORKING: "DONE",
};

const ACTION_LABEL: Partial<Record<TaskStatus, string>> = {
  NEW: "Взять в работу",
  WORKING: "Завершить",
};

export function TaskStatusControl({
  taskId,
  status,
  version,
}: {
  taskId: string;
  status: TaskStatus;
  version: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStatus = NEXT_STATUS[status];

  if (!nextStatus) return null;

  async function updateStatus() {
    if (pending || !nextStatus) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/platform/tasks/${encodeURIComponent(taskId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status: nextStatus, expectedVersion: version }),
      });

      if (response.status === 409) {
        setError("Задача уже была изменена. Данные обновлены.");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError("Не удалось изменить статус задачи.");
        return;
      }

      router.refresh();
    } catch {
      setError("Сервис задач временно недоступен.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={updateStatus}
        disabled={pending}
        className="rounded-xl bg-[#17202a] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : ACTION_LABEL[status]}
      </button>
      {error ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
