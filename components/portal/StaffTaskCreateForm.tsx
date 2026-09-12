"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type TaskCreateResponse =
  | { ok: true; data: { id: string } }
  | { ok: false; error: { code?: string } };

function errorMessage(code: string | undefined) {
  switch (code) {
    case "CASE_UNASSIGNED":
      return "Сначала назначьте ответственного юриста по делу.";
    case "FORBIDDEN":
      return "У вас нет права создавать задачи по этому делу.";
    case "INVALID_INPUT":
      return "Проверьте название, описание и срок задачи.";
    default:
      return "Не удалось создать задачу. Обновите страницу и повторите попытку.";
  }
}

export function StaffTaskCreateForm({
  caseId,
  enabled,
}: {
  caseId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || pending) return;

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("Укажите название задачи.");
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    let normalizedDueAt: string | null = null;
    if (dueAt) {
      const parsedDueAt = new Date(dueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        setError("Проверьте срок задачи.");
        setPending(false);
        return;
      }
      normalizedDueAt = parsedDueAt.toISOString();
    }

    try {
      const response = await fetch(
        `/api/platform/cases/${encodeURIComponent(caseId)}/tasks`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: normalizedTitle,
            description: description.trim() || null,
            dueAt: normalizedDueAt,
          }),
        },
      );
      const result = (await response.json()) as TaskCreateResponse;
      if (!result.ok) {
        setError(errorMessage(result.error.code));
        return;
      }

      setTitle("");
      setDescription("");
      setDueAt("");
      setSuccess("Задача создана и назначена ответственному юристу дела.");
      router.refresh();
    } catch {
      setError("Не удалось создать задачу. Проверьте соединение и повторите попытку.");
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return (
      <section className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50/70 p-5 text-sm leading-6 text-amber-900">
        <p className="font-bold">Создание задач временно недоступно</p>
        <p className="mt-1 text-amber-800">
          Сначала назначьте ответственного юриста по делу. После назначения новые задачи будут автоматически закрепляться за ним.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-6" aria-labelledby="create-task-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Новая задача</p>
        <h2 id="create-task-heading" className="mt-2 text-xl font-bold text-slate-900">Добавить задачу по делу</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Исполнитель определяется автоматически по текущему ответственному юристу дела.
        </p>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Название
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            required
            disabled={pending}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-slate-400 disabled:opacity-60"
            placeholder="Например: проверить комплект документов"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Описание
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={4}
            disabled={pending}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal leading-6 outline-none transition focus:border-slate-400 disabled:opacity-60"
            placeholder="Кратко опишите ожидаемый результат"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:max-w-xs">
          Срок
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            disabled={pending}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-slate-400 disabled:opacity-60"
          />
        </label>

        {error ? <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p> : null}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {pending ? "Создаём…" : "Создать задачу"}
          </button>
        </div>
      </form>
    </section>
  );
}
