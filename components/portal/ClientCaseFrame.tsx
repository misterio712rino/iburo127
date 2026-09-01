import type { ReactNode } from "react";
import Link from "next/link";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { ClientCaseNavigation } from "@/components/portal/ClientCaseNavigation";

export type ClientCaseOption = {
  id: string;
  caseNumber: string;
  planLabel: string;
};

function CaseSwitcher({
  caseId,
  caseNumber,
  planLabel,
  cases,
  compact = false,
}: {
  caseId: string;
  caseNumber: string;
  planLabel: string;
  cases: readonly ClientCaseOption[];
  compact?: boolean;
}) {
  if (cases.length <= 1) {
    return compact ? (
      <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold text-[#4d5055]">Тариф {planLabel}</span>
        <span className="shrink-0 font-mono text-[10px] text-[#92908a]">{caseNumber}</span>
      </div>
    ) : null;
  }

  return (
    <details className={`group rounded-2xl border border-black/8 bg-white/60 ${compact ? "p-3" : "p-3.5"}`}>
      <summary className="cursor-pointer list-none text-xs font-semibold text-[#262a31] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9202b]/15">
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate">{planLabel}</span>
            <span className="mt-1 block truncate font-mono text-[10px] font-medium text-[#8b8b88]">{caseNumber}</span>
          </span>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b9202b]">Сменить дело</span>
        </span>
      </summary>
      <div className="mt-3 space-y-1 border-t border-black/5 pt-3">
        {cases.map((item) => (
          <Link
            key={item.id}
            href={`/portal/cases/${item.id}`}
            aria-current={item.id === caseId ? "page" : undefined}
            className={`block rounded-xl px-2.5 py-2 text-xs transition ${
              item.id === caseId ? "bg-[#b9202b]/[0.07] text-[#9e1e28]" : "text-[#5d6065] hover:bg-[#f6f2ed]"
            }`}
          >
            <span className="block font-semibold">{item.planLabel}</span>
            <span className="mt-0.5 block font-mono text-[10px] opacity-70">{item.caseNumber}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export function ClientCaseFrame({
  children,
  caseId,
  caseNumber,
  displayName,
  planLabel,
  cases,
}: {
  children: ReactNode;
  caseId: string;
  caseNumber: string;
  displayName: string;
  planLabel: string;
  cases: readonly ClientCaseOption[];
}) {
  const base = `/portal/cases/${caseId}`;

  return (
    <div className="min-h-screen bg-[#f4f0ea] text-[#191d25]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-black/5 bg-[#f8f5f0] px-5 py-6 lg:flex">
        <Link href={base} className="inline-flex w-fit items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9202b]/15">
          <IBuroBrand dot className="text-2xl font-semibold tracking-[-0.05em]" />
        </Link>

        <ClientCaseNavigation caseId={caseId} />

        <div className="mt-auto space-y-3">
          {cases.length > 1 ? (
            <CaseSwitcher caseId={caseId} caseNumber={caseNumber} planLabel={planLabel} cases={cases} />
          ) : (
            <div className="rounded-2xl border border-black/8 bg-white/55 p-3.5">
              <p className="truncate text-xs font-semibold">{displayName}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-[#8b8b88]">Дело {caseNumber}</p>
            </div>
          )}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f8f5f0]/95 backdrop-blur-xl">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
            <div>
              <Link href={base} className="rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9202b]/15 lg:hidden">
                <IBuroBrand dot className="text-xl font-semibold tracking-[-0.05em]" />
              </Link>
              <p className="hidden text-xs font-medium text-[#92918d] lg:block">Платформа сопровождения</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-48 truncate text-xs font-semibold text-[#2c3036]">{displayName}</p>
                <p className="mt-0.5 text-[10px] font-medium text-[#96948f]">Тариф {planLabel}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
          <div className="border-t border-black/[0.035] lg:hidden">
            <ClientCaseNavigation caseId={caseId} mobile />
          </div>
          <div className="border-t border-black/[0.035] px-4 py-2 lg:hidden sm:px-8">
            <CaseSwitcher caseId={caseId} caseNumber={caseNumber} planLabel={planLabel} cases={cases} compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
