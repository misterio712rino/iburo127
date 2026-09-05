"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { StaffTaskCards } from "@/components/portal/StaffTaskCards";
import type { StaffTaskPresentationItem } from "@/server/tasks/staff-task-view";

type TaskFilter = "ALL" | "NEW" | "WORKING" | "DONE" | "OVERDUE";

const FILTERS: readonly { value: TaskFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "NEW", label: "Новые" },
  { value: "WORKING", label: "В работе" },
  { value: "DONE", label: "Завершённые" },
  { value: "OVERDUE", label: "Просроченные" },
];

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/gu, " ")
    .trim();
}

function matchesFilter(item: StaffTaskPresentationItem, filter: TaskFilter) {
  if (filter === "ALL") return true;
  if (filter === "OVERDUE") return item.isOverdue;
  return item.status === filter;
}

function emptyMessage(query: string, filter: TaskFilter) {
  if (query) return "По вашему запросу задач не найдено.";
  if (filter === "OVERDUE") return "Просроченных задач нет.";
  if (filter === "NEW") return "Новых задач нет.";
  if (filter === "WORKING") return "Задач в работе нет.";
  if (filter === "DONE") return "Завершённых задач пока нет.";
  return "Доступных задач сейчас нет.";
}

export function StaffTaskWorkspace({ items }: { items: readonly StaffTaskPresentationItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("ALL");
  const normalizedQuery = normalizeSearchText(query);

  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<TaskFilter, number>>(
        (result, item) => {
          result[item.value] = items.filter((task) => matchesFilter(task, item.value)).length;
          return result;
        },
        { ALL: 0, NEW: 0, WORKING: 0, DONE: 0, OVERDUE: 0 },
      ),
    [items],
  );

  const visibleItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter) && (!normalizedQuery || item.normalizedSearchText.includes(normalizedQuery))),
    [filter, items, normalizedQuery],
  );

  if (!items.length) return <StaffTaskCards items={items} />;

  return (
    <div className="grid gap-4">
      <section className="rounded-[20px] border border-[#e2e5e7] bg-white p-4 sm:p-5" aria-label="Поиск и фильтры задач">
        <label className="relative block min-w-0">
          <span className="sr-only">Поиск по клиенту, задаче или номеру дела</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по клиенту, задаче или номеру дела"
            aria-label="Поиск по клиенту, задаче или номеру дела"
            className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-[#fafafa] py-2.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#b41f2b]/40 focus:bg-white focus:ring-4 focus:ring-[#b41f2b]/10"
          />
        </label>

        <div className="mt-3 flex min-w-0 flex-wrap gap-1.5" role="group" aria-label="Фильтр задач по статусу">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.value)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/15 ${
                  active
                    ? "border-[#b41f2b]/20 bg-[#b41f2b]/8 text-[#a51b25]"
                    : "border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
                <span className={`tabular-nums ${active ? "text-[#a51b25]/65" : "text-slate-400"}`} aria-hidden="true">{counts[item.value]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <p className="text-xs font-semibold text-slate-400" role="status" aria-live="polite">Показано задач: {visibleItems.length}</p>
      <StaffTaskCards items={visibleItems} emptyMessage={emptyMessage(normalizedQuery, filter)} />
    </div>
  );
}
