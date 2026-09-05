import type { ReactNode } from "react";
import Link from "next/link";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { ClientCaseNavigation } from "@/components/portal/ClientCaseNavigation";
import { PortalMotionContent } from "@/components/portal/PortalMotionContent";
import { PortalMotionStyles } from "@/components/portal/PortalMotionStyles";

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

function initials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "iБ";
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
  const normalizedPlanLabel = planLabel.trim().toLocaleUpperCase("ru-RU");
  const theme = normalizedPlanLabel === "ПРО" ? "pro" : normalizedPlanLabel === "ИНДИВИДУАЛЬНЫЙ" ? "individual" : "lite";
  const userInitials = initials(displayName);

  return (
    <div data-client-plan={theme} className="portal-motion-shell client-case-shell min-h-screen bg-[#f4f0ea] text-[#191d25]">
      <PortalMotionStyles />
      <style>{`
        .client-case-shell { --ib-accent:#bf202b; --ib-accent-soft:#f3e3e1; --ib-shell:#f4eee7; --ib-sidebar:#faf6f0; --ib-header:#fffaf5; --ib-card:rgba(255,253,249,.92); --ib-card-border:rgba(84,57,44,.08); --ib-text:#25272b; --ib-muted:#8f8a83; --ib-line:#ded9d2; --ib-shadow:0 14px 44px rgba(83,59,43,.07); }
        .client-case-shell[data-client-plan="pro"] { --ib-accent:#78a8dd; --ib-accent-soft:#244d77; --ib-shell:#153b60; --ib-sidebar:#0e2d49; --ib-header:#153858; --ib-card:#173b60; --ib-card-border:rgba(139,184,229,.18); --ib-text:#f4f8fc; --ib-muted:#9eb9d2; --ib-line:#315676; --ib-shadow:0 16px 45px rgba(3,21,39,.18); color-scheme:dark; }
        .client-case-shell[data-client-plan="individual"] { --ib-accent:#c91f2b; --ib-accent-soft:#3a292e; --ib-shell:#202126; --ib-sidebar:#1a1b20; --ib-header:#24242a; --ib-card:#27272d; --ib-card-border:rgba(255,255,255,.08); --ib-text:#f7f5f3; --ib-muted:#9f9da1; --ib-line:#3a3a40; --ib-shadow:0 18px 55px rgba(0,0,0,.18); color-scheme:dark; }
        .client-case-shell { background:var(--ib-shell)!important; color:var(--ib-text); }
        .client-case-shell > aside { width:240px!important; background:var(--ib-sidebar)!important; border-color:var(--ib-card-border)!important; }
        .client-case-shell > div { padding-left:240px!important; }
        .client-case-shell header { min-height:74px; background:color-mix(in srgb,var(--ib-header) 96%,transparent)!important; border-color:var(--ib-card-border)!important; }
        .client-case-shell header > div:first-child { min-height:74px!important; }
        .client-case-shell main { max-width:1160px!important; padding-top:42px!important; padding-bottom:48px!important; }
        .client-case-shell nav a { color:var(--ib-muted)!important; }
        .client-case-shell nav a[aria-current="page"] { color:var(--ib-text)!important; border-color:color-mix(in srgb,var(--ib-accent) 35%,transparent)!important; background:color-mix(in srgb,var(--ib-card) 94%,transparent)!important; box-shadow:0 8px 24px rgba(0,0,0,.08)!important; }
        .client-case-shell nav a:hover { color:var(--ib-text)!important; background:color-mix(in srgb,var(--ib-card) 76%,transparent)!important; }
        .client-case-shell aside > div:last-child > div, .client-case-shell aside details { background:color-mix(in srgb,var(--ib-card) 64%,transparent)!important; border-color:var(--ib-card-border)!important; color:var(--ib-text)!important; }
        .client-case-shell aside p, .client-case-shell aside summary, .client-case-shell aside span { color:inherit; }
        .client-case-shell header p { color:var(--ib-muted)!important; }
        .client-user-menu { position:relative; }
        .client-user-menu summary { list-style:none; cursor:pointer; }
        .client-user-menu summary::-webkit-details-marker { display:none; }
        .client-user-chip { display:flex; min-width:205px; align-items:center; gap:10px; border:1px solid var(--ib-card-border); border-radius:999px; background:color-mix(in srgb,var(--ib-card) 82%,transparent); padding:6px 10px 6px 7px; box-shadow:0 6px 18px rgba(0,0,0,.06); }
        .client-user-avatar { display:grid; width:32px; height:32px; place-items:center; flex:0 0 auto; border-radius:999px; background:var(--ib-accent); color:white; font-size:10px; font-weight:800; }
        .client-case-shell[data-client-plan="pro"] .client-user-avatar { color:#102e49; }
        .client-user-copy { min-width:0; flex:1; }
        .client-user-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ib-text)!important; font-size:11px!important; font-weight:700!important; }
        .client-user-plan { margin-top:1px; color:var(--ib-muted)!important; font-size:9px!important; }
        .client-user-chevron { color:var(--ib-muted); font-size:15px; transform:translateY(-1px); transition:transform .2s ease; }
        .client-user-menu[open] .client-user-chevron { transform:rotate(180deg); }
        .client-user-popover { position:absolute; right:0; top:calc(100% + 8px); z-index:70; width:180px; border:1px solid var(--ib-card-border); border-radius:16px; background:var(--ib-card); padding:8px; box-shadow:0 16px 45px rgba(0,0,0,.16); }
        .client-user-popover button { width:100%; border:0!important; background:transparent!important; box-shadow:none!important; color:var(--ib-text)!important; }
        .client-case-shell main > div > section:first-child h1 { color:var(--ib-text)!important; font-size:42px!important; font-weight:500!important; letter-spacing:-.035em!important; }
        .client-case-shell main > div > section:first-child p { color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:first-child span:last-child { color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:first-child span:first-child { border-color:color-mix(in srgb,var(--ib-accent) 32%,transparent)!important; background:color-mix(in srgb,var(--ib-accent) 10%,transparent)!important; color:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(2) { gap:18px!important; grid-template-columns:minmax(0,1.62fr) minmax(280px,.78fr)!important; }
        .client-case-shell main > div > section:nth-child(2) > div:first-child { min-height:260px!important; border-radius:23px!important; padding:27px 28px!important; background:#c53b40!important; box-shadow:var(--ib-shadow)!important; }
        .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child { background:#75a3d4!important; color:#102f4c!important; }
        .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child p { color:#173c5d!important; }
        .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child a { background:#102f4d!important; color:#8bb7e6!important; }
        .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(2) > div:first-child { background:#b91f29!important; }
        .client-case-shell main > div > section:nth-child(2) > article { border-radius:23px!important; background:var(--ib-card)!important; border-color:var(--ib-card-border)!important; box-shadow:var(--ib-shadow)!important; color:var(--ib-text)!important; }
        .client-case-shell main > div > section:nth-child(2) > article p { color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:nth-child(2) > article p[class*="text-2xl"], .client-case-shell main > div > section:nth-child(2) > article p[class*="text-3xl"] { color:var(--ib-text)!important; }
        .client-case-shell main > div > section:nth-child(2) > article span { color:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(2) > article [class*="bg-[#ebe8e3]"] { background:color-mix(in srgb,var(--ib-line) 75%,transparent)!important; }
        .client-case-shell main > div > section:nth-child(2) > article [class*="bg-[#b9202b]"] { background:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(3) { border-radius:23px!important; background:var(--ib-card)!important; border-color:var(--ib-card-border)!important; box-shadow:var(--ib-shadow)!important; }
        .client-case-shell main > div > section:nth-child(3) h2 { color:var(--ib-text)!important; }
        .client-case-shell main > div > section:nth-child(3) p { color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:nth-child(3) li span[class*="bg-[#b9202b]"] { background:var(--ib-accent)!important; border-color:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(3) li span[class*="bg-white"] { background:var(--ib-card)!important; color:var(--ib-accent)!important; border-color:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(3) li span[class*="bg-[#eeece8]"] { background:color-mix(in srgb,var(--ib-card) 75%,var(--ib-line))!important; border-color:var(--ib-line)!important; color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:nth-child(3) li > span:first-child { background:var(--ib-line)!important; }
        .client-case-shell main > div > section:nth-child(3) li p[class*="font-semibold"] { color:var(--ib-text)!important; }
        .client-case-shell main > div > section:nth-child(4) h2 { color:var(--ib-text)!important; font-size:26px!important; }
        .client-case-shell main > div > section:nth-child(4) p { color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:nth-child(4) > div:last-child > a,
        .client-case-shell main > div > section:nth-child(4) > div:last-child > article { min-height:198px!important; border-radius:20px!important; background:var(--ib-card)!important; border-color:var(--ib-card-border)!important; box-shadow:none!important; padding:18px!important; color:var(--ib-text)!important; }
        .client-case-shell main > div > section:nth-child(4) > div:last-child > a:hover { transform:translateY(-3px)!important; box-shadow:var(--ib-shadow)!important; }
        .client-case-shell main > div > section:nth-child(4) h3 { color:var(--ib-text)!important; }
        .client-case-shell main > div > section:nth-child(4) [class*="bg-[#f0eeea]"] { background:color-mix(in srgb,var(--ib-accent) 10%,var(--ib-card))!important; color:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(4) [aria-label^="Прогресс"] { background:var(--ib-line)!important; }
        .client-case-shell main > div > section:nth-child(4) [aria-label^="Прогресс"] > div { background:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(4) a > p:last-child { color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:nth-child(5) > article { border-radius:21px!important; background:var(--ib-card)!important; border-color:var(--ib-card-border)!important; box-shadow:var(--ib-shadow)!important; }
        .client-case-shell main > div > section:nth-child(5) h2,
        .client-case-shell main > div > section:nth-child(5) p[class*="font-semibold"] { color:var(--ib-text)!important; }
        .client-case-shell main > div > section:nth-child(5) p,
        .client-case-shell main > div > section:nth-child(5) div { border-color:var(--ib-card-border)!important; color:var(--ib-muted)!important; }
        .client-case-shell main > div > section:nth-child(5) [class*="bg-[#f0eeea]"] { background:color-mix(in srgb,var(--ib-accent) 10%,var(--ib-card))!important; color:var(--ib-accent)!important; }
        .client-case-shell main > div > section:nth-child(5) [class*="bg-[#bd1f2b]"] { background:var(--ib-accent)!important; color:white!important; }
        .client-case-shell main > div > section:nth-child(5) a { border-color:var(--ib-card-border)!important; background:transparent!important; color:var(--ib-text)!important; }
        .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > article[class*="opacity-70"],
        .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > a[class*="opacity-70"] { opacity:.58!important; }
        .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > article[class*="opacity-70"] { opacity:.62!important; }
        @media (max-width:1023px) {
          .client-case-shell > div { padding-left:0!important; }
          .client-case-shell main { padding-top:28px!important; }
        }
        @media (max-width:639px) {
          .client-case-shell main > div > section:first-child h1 { font-size:34px!important; }
          .client-user-chip { min-width:0; }
          .client-user-copy { display:none; }
        }
      `}</style>

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

            <details className="client-user-menu">
              <summary className="client-user-chip" aria-label="Меню профиля">
                <span className="client-user-avatar">{userInitials}</span>
                <span className="client-user-copy">
                  <span className="client-user-name block">{displayName}</span>
                  <span className="client-user-plan block">Тариф {planLabel}</span>
                </span>
                <span className="client-user-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="client-user-popover">
                <SignOutButton />
              </div>
            </details>
          </div>
          <div className="border-t border-black/[0.035] lg:hidden">
            <ClientCaseNavigation caseId={caseId} mobile />
          </div>
          <div className="border-t border-black/[0.035] px-4 py-2 lg:hidden sm:px-8">
            <CaseSwitcher caseId={caseId} caseNumber={caseNumber} planLabel={planLabel} cases={cases} compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <PortalMotionContent>{children}</PortalMotionContent>
        </main>
      </div>
    </div>
  );
}
