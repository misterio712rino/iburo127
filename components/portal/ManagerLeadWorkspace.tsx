"use client";

import { Mail, Phone, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  type ManagerLeadStatus,
  type ManagerLeadView,
} from "@/server/prospect-leads/manager-lead-view";

type LeadFilter = "ALL" | ManagerLeadStatus;

const FILTERS: readonly { value: LeadFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "NEW", label: "Новые" },
  { value: "CONVERTED", label: "Конвертированные" },
  { value: "ARCHIVED", label: "Архив" },
];

const STATUS_STYLES: Record<ManagerLeadStatus, string> = {
  NEW: "text-[#a51b25]",
  CONVERTED: "text-emerald-700",
  ARCHIVED: "text-slate-500",
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/gu, " ")
    .trim();
}

function emptyMessage(query: string, filter: LeadFilter) {
  if (query) return "По вашему запросу потенциальных клиентов не найдено.";
  if (filter === "NEW") return "Новых потенциальных клиентов нет.";
  if (filter === "CONVERTED") return "Конвертированных потенциальных клиентов нет.";
  if (filter === "ARCHIVED") return "В архиве пока нет потенциальных клиентов.";
  return "Потенциальных клиентов из формы входа пока нет.";
}

function LeadStatusBadge({ item }: { item: ManagerLeadView }) {
  return (
    <span className={`inline-flex min-h-7 items-center text-[10px] font-bold uppercase tracking-[0.07em] ${STATUS_STYLES[item.status]}`}>
      {item.statusLabel}
    </span>
  );
}

function LeadTypeBadge({ item }: { item: ManagerLeadView }) {
  const Icon = item.contactType === "EMAIL" ? Mail : Phone;
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500">
      <Icon className="size-3.5" aria-hidden="true" />
      {item.contactTypeLabel}
    </span>
  );
}

function LeadCards({ items, emptyText }: { items: readonly ManagerLeadView[]; emptyText: string }) {
  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-[#d5dadd] bg-white/60 p-7 text-sm leading-6 text-[#7a8389]">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[20px] border border-[#e2e5e7] bg-white md:block">
        <table className="w-full table-fixed text-left text-sm text-[#4d555b]">
          <thead className="border-b border-[#eceff1] bg-[#f7f8f8] text-[10px] font-bold uppercase tracking-[0.09em] text-[#8f969b]">
            <tr>
              <th scope="col" className="w-[29%] px-5 py-3.5 font-bold lg:px-6">Контакт</th>
              <th scope="col" className="w-[16%] px-4 py-3.5 font-bold">Статус</th>
              <th scope="col" className="w-[13%] px-4 py-3.5 font-bold">Тип</th>
              <th scope="col" className="w-[10%] px-4 py-3.5 font-bold">Попыток</th>
              <th scope="col" className="w-[16%] px-4 py-3.5 font-bold">Первое обращение</th>
              <th scope="col" className="w-[16%] px-5 py-3.5 font-bold lg:px-6">Последнее обращение</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f2]">
            {items.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-[#fafbfb]">
                <td className="break-all px-5 py-4 font-semibold text-[#202326] lg:px-6">{item.contact}</td>
                <td className="px-4 py-4"><LeadStatusBadge item={item} /></td>
                <td className="px-4 py-4"><LeadTypeBadge item={item} /></td>
                <td className="px-4 py-4 font-semibold tabular-nums text-[#4d555b]">{item.attemptCount}</td>
                <td className="px-4 py-4 text-xs text-[#737a80]">{item.firstSeenLabel}</td>
                <td className="px-5 py-4 text-xs text-[#737a80] lg:px-6">{item.lastSeenLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid min-w-0 gap-3 md:hidden">
        {items.map((item) => {
          const Icon = item.contactType === "EMAIL" ? Mail : Phone;
          return (
            <article key={item.id} className="min-w-0 rounded-[20px] border border-[#e2e5e7] bg-white p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3f4f5] text-[#8f1720]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="break-all text-sm font-bold leading-5 text-[#202326]">{item.contact}</p>
                    <p className="mt-1 text-xs font-medium text-[#8f969b]">{item.contactTypeLabel}</p>
                  </div>
                </div>
                <LeadStatusBadge item={item} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#edf0f2] pt-4 text-xs">
                <div>
                  <dt className="text-[#8f969b]">Попыток</dt>
                  <dd className="mt-1 font-bold tabular-nums text-[#343b40]">{item.attemptCount}</dd>
                </div>
                <div>
                  <dt className="text-[#8f969b]">Тип контакта</dt>
                  <dd className="mt-1 font-semibold text-[#4d555b]">{item.contactTypeLabel}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#8f969b]">Первое обращение</dt>
                  <dd className="mt-1 break-words font-semibold leading-5 text-[#4d555b]">{item.firstSeenLabel}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#8f969b]">Последнее обращение</dt>
                  <dd className="mt-1 break-words font-semibold leading-5 text-[#4d555b]">{item.lastSeenLabel}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function ManagerLeadWorkspace({ items }: { items: readonly ManagerLeadView[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("ALL");
  const normalizedQuery = normalizeSearchText(query);

  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<LeadFilter, number>>(
        (result, item) => {
          result[item.value] = item.value === "ALL"
            ? items.length
            : items.filter((lead) => lead.status === item.value).length;
          return result;
        },
        { ALL: 0, NEW: 0, CONVERTED: 0, ARCHIVED: 0 },
      ),
    [items],
  );

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (filter === "ALL" || item.status === filter) &&
          (!normalizedQuery || item.normalizedSearchText.includes(normalizedQuery)),
      ),
    [filter, items, normalizedQuery],
  );

  if (!items.length) {
    return <LeadCards items={items} emptyText={emptyMessage("", "ALL")} />;
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="rounded-[20px] border border-[#e2e5e7] bg-white p-4 sm:p-5" aria-label="Поиск и фильтры потенциальных клиентов">
        <label className="relative block min-w-0">
          <span className="sr-only">Поиск по email или телефону</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#8f969b]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по email или телефону"
            aria-label="Поиск по email или телефону"
            className="min-h-11 w-full min-w-0 rounded-xl border border-[#dfe3e6] bg-white py-2.5 pl-11 pr-4 text-sm text-[#202326] outline-none transition-colors placeholder:text-[#9ca2a7] focus:border-[#8f1720]/45 focus:ring-4 focus:ring-[#8f1720]/10"
          />
        </label>

        <div className="mt-3 flex min-w-0 flex-wrap gap-2" role="group" aria-label="Фильтр потенциальных клиентов по статусу">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.value)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/15 ${
                  active
                    ? "border-[#8f1720]/25 bg-[#8f1720]/[0.06] text-[#8f1720]"
                    : "border-[#e0e3e5] bg-white text-[#666f75] hover:bg-[#f6f7f7] hover:text-[#343b40]"
                }`}
              >
                {item.label}
                <span className={`tabular-nums ${active ? "text-[#8f1720]/65" : "text-[#9aa1a6]"}`} aria-hidden="true">
                  {counts[item.value]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <p className="text-xs font-semibold text-[#8f969b]" role="status" aria-live="polite">
        Показано потенциальных клиентов: {visibleItems.length}
      </p>

      <LeadCards items={visibleItems} emptyText={emptyMessage(normalizedQuery, filter)} />
    </div>
  );
}
