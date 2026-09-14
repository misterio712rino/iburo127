"use client";

import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/platform/PlatformPrimitives";
import type { GeneratedDocument } from "@/lib/platform/types";
import { DocumentStatus } from "./DocumentStatus";

function formatDate(value:string){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Moscow"}).format(new Date(value));}
export function DocumentCard({document,onOpen}:{document:GeneratedDocument;onOpen:()=>void}) {
  const disabled=document.status==="waiting_data"&&document.completeness<=25;
  return <article className="flex min-w-0 flex-col rounded-[1.4rem] border border-border bg-card p-5 text-card-foreground shadow-[0_14px_40px_rgba(0,0,0,.045)] sm:p-6"><div className="flex items-start justify-between gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><FileText className="size-5"/></span><DocumentStatus status={document.status}/></div><h2 className="mt-6 break-words text-lg font-semibold tracking-[-.025em]">{document.definition.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{document.definition.description}</p><div className="mt-6"><div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Данные источника</span><span className="font-semibold">{document.completeness}%</span></div><ProgressBar value={document.completeness}/></div><p className="mt-4 text-xs text-muted-foreground">Обновлено: {formatDate(document.updatedAt)}</p><Button variant="outline" className="mt-6 h-auto min-h-11 w-full whitespace-normal rounded-full px-4 py-3" onClick={onOpen} disabled={disabled}>{disabled?"Сначала заполните анкету":"Открыть документ"}{disabled?null:<ArrowRight data-icon="inline-end"/>}</Button></article>;
}
