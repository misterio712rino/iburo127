"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiComposer({ disabled, onSend }: { disabled: boolean; onSend: (message: string) => void }) {
  const [value, setValue] = useState("");
  function submit() { const next = value.trim(); if (!next || disabled) return; onSend(next); setValue(""); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }
  return <div className="border-t border-border p-3 sm:p-4">
    <label htmlFor="ai-message" className="sr-only">Вопрос AI-помощнику</label>
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
      <textarea id="ai-message" value={value} maxLength={1000} rows={2} disabled={disabled} onChange={(event) => setValue(event.target.value)} onKeyDown={onKeyDown} placeholder="Задайте вопрос о вашем деле или работе платформы" className="min-h-20 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 sm:text-sm" />
      <Button type="button" className="h-11 w-full rounded-full px-5 sm:w-auto" disabled={disabled || !value.trim()} onClick={submit}>Отправить<Send data-icon="inline-end" /></Button>
    </div>
    <p className="mt-2 px-1 text-[11px] text-muted-foreground">Enter — отправить, Shift + Enter — новая строка</p>
  </div>;
}
