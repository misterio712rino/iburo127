import { CheckCircle2, Clock3, FilePenLine, Send } from "lucide-react";
import type { DocumentStatus as Status } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

const config:Record<Status,{label:string;Icon:typeof Clock3}>={waiting_data:{label:"Ожидает данных",Icon:Clock3},draft:{label:"Черновик",Icon:FilePenLine},ready_for_review:{label:"Готово к проверке",Icon:CheckCircle2},reviewed:{label:"Проверено",Icon:CheckCircle2},sent_for_review:{label:"Передано на проверку",Icon:Send}};
export function DocumentStatus({status}:{status:Status}){const {label,Icon}=config[status];return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground",(status==="ready_for_review"||status==="reviewed"||status==="sent_for_review")&&"border-primary/25 bg-primary/10 text-primary")}><Icon className="size-3" aria-hidden="true"/>{label}</span>;}
