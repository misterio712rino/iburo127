import Link from "next/link";
import { Bot, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiMessage as AiMessageType } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

export function AiMessage({ message }: { message: AiMessageType }) {
  const assistant = message.role === "assistant";
  return <article className={cn("flex min-w-0 gap-3", !assistant && "justify-end")}>
    {assistant ? <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Bot className="size-4" aria-hidden="true" /></span> : null}
    <div className={cn("min-w-0 max-w-[88%] rounded-[1.3rem] px-4 py-3 sm:max-w-[78%] sm:px-5 sm:py-4", assistant ? "border border-border bg-muted/55" : "bg-primary text-primary-foreground")}>
      <p className="whitespace-pre-line break-words text-sm leading-6">{message.content}</p>
      {message.action?.href ? <Button render={<Link href={message.action.href} />} nativeButton={false} variant="outline" className="mt-4 min-h-11 max-w-full rounded-full bg-background px-4 py-2.5 text-foreground">{message.action.label}</Button> : null}
    </div>
    {!assistant ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><UserRound className="size-4" aria-hidden="true" /></span> : null}
  </article>;
}
