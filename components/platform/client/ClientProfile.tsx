"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowRightLeft, Bell, Mail, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { PlanBadge, PlatformCard, ProfileAvatar, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { ClientRouteGuard } from "@/components/platform/practicum/ClientRouteGuard";
import { getCaseForIdentity } from "@/lib/platform/demo";

const contacts: Record<string, { email: string; phone: string }> = {
  "alexander-lite": { email: "alexander.lebedev@mail.ru", phone: "+7 916 245-18-42" },
  "maria-pro": { email: "maria.sokolova@mail.ru", phone: "+7 903 718-26-51" },
  "dmitry-individual": { email: "dmitry.volkov@mail.ru", phone: "+7 921 640-37-82" },
};
type Settings = { caseUpdates: boolean; lawyerMessages: boolean; documents: boolean };
const defaults: Settings = { caseUpdates: true, lawyerMessages: true, documents: true };

export function ClientProfile() { return <ClientRouteGuard><PlatformShell><ProfileContent /></PlatformShell></ClientRouteGuard>; }

function ProfileContent() {
  const { identity } = useDemoIdentity();
  const clientCase = getCaseForIdentity(identity.id)!;
  const contact = contacts[identity.id];
  const key = `iburo.profile.settings.v1.${identity.id}`;
  const stored = useSyncExternalStore((callback) => {
    window.addEventListener("storage", callback);
    window.addEventListener("iburo-profile-settings", callback);
    return () => { window.removeEventListener("storage", callback); window.removeEventListener("iburo-profile-settings", callback); };
  }, () => window.localStorage.getItem(key) ?? "", () => "");
  let settings = defaults;
  try { if (stored) settings = JSON.parse(stored) as Settings; } catch {}
  const [status, setStatus] = useState<string>();
  function toggle(name: keyof Settings) {
    const next = { ...settings, [name]: !settings[name] };
    window.localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event("iburo-profile-settings"));
    setStatus("Настройки сохранены");
  }

  return <div className="flex min-w-0 flex-col gap-7 sm:gap-9">
    <SectionHeader title="Профиль" description="Личные данные, параметры дела и настройки уведомлений." />
    <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <PlatformCard className="p-6"><div className="flex items-center gap-4"><ProfileAvatar initials={identity.initials} className="size-14" /><div><h2 className="text-xl font-semibold">{identity.displayName}</h2><p className="mt-1 text-sm text-muted-foreground">Дело № {clientCase.caseNumber}</p></div></div><div className="mt-7 space-y-4"><Row label="Тариф" value={<PlanBadge plan={clientCase.plan} />} /><Row label="Дата открытия" value={clientCase.openedDate} /><Row label="Текущий этап" value={clientCase.stage} /><Row label="Юрист" value={clientCase.assignedLawyer} /></div></PlatformCard>
      <div className="grid gap-5"><PlatformCard className="p-6"><h2 className="text-xl font-semibold">Контакты</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Contact icon={Mail} label="Электронная почта" value={contact.email} /><Contact icon={Smartphone} label="Телефон" value={contact.phone} /></div></PlatformCard><PlatformCard className="p-6"><div className="flex items-center gap-3"><Bell className="size-5 text-primary" /><h2 className="text-xl font-semibold">Уведомления</h2></div><div className="mt-5 divide-y divide-border"><Toggle label="Изменения по делу" checked={settings.caseUpdates} onClick={() => toggle("caseUpdates")} /><Toggle label="Сообщения юриста" checked={settings.lawyerMessages} onClick={() => toggle("lawyerMessages")} /><Toggle label="Готовность документов" checked={settings.documents} onClick={() => toggle("documents")} /></div>{status ? <p role="status" className="mt-4 text-xs text-primary">{status}</p> : null}</PlatformCard></div>
    </section>
    <PlatformCard className="p-6"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><ArrowRightLeft className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">Выбор профиля</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Чтобы посмотреть другой профиль, вернитесь к выбору профиля.</p><Button render={<Link href="/app" />} nativeButton={false} variant="outline" className="mt-5 h-11 rounded-full">Сменить профиль<ArrowRightLeft data-icon="inline-end" /></Button></div></div></PlatformCard>
  </div>;
}

function Row({ label, value }: { label: string; value: ReactNode }) { return <div className="flex items-center justify-between gap-4 border-b border-border pb-4 text-sm last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>; }
function Contact({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) { return <div className="flex min-w-0 gap-3 rounded-2xl bg-muted p-4"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div></div>; }
function Toggle({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) { return <button type="button" role="switch" aria-checked={checked} onClick={onClick} className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium"><span>{label}</span><span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} /></span></button>; }
