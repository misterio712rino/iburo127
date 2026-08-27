"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, RotateCcw, ShieldCheck } from "lucide-react";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { ClientRouteGuard } from "@/components/platform/practicum/ClientRouteGuard";
import { PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { Button } from "@/components/ui/button";
import { useDocumentState } from "@/components/platform/documents/useDocumentState";
import { usePracticumProgress } from "@/components/platform/practicum/usePracticumProgress";
import { useQuestionnaireState } from "@/components/platform/questionnaire/useQuestionnaireState";
import { AI_SUGGESTIONS, buildAiContext, demoAssistant } from "@/lib/platform/ai";
import { generateDocuments, getCaseForIdentity, getDashboardForIdentity, getQuestionnaireSummary } from "@/lib/platform/demo";
import type { AiContext, DemoIdentity } from "@/lib/platform/types";
import { AiComposer } from "./AiComposer";
import { AiContextPanel } from "./AiContextPanel";
import { AiLockedState } from "./AiLockedState";
import { AiMessage } from "./AiMessage";
import { useAiConversation } from "./useAiConversation";
import { IBuroBrand } from "@/components/platform/IBuroBrand";

export function AiAssistant() {
  const { identity } = useDemoIdentity();
  return <ClientRouteGuard><PlatformShell>{identity.role === "CLIENT" ? identity.plan === "INDIVIDUAL" ? <AiChat key={identity.id} identity={identity} /> : <AiLockedState plan={identity.plan!} /> : null}</PlatformShell></ClientRouteGuard>;
}

function AiChat({ identity }: { identity: DemoIdentity }) {
  const clientCase = getCaseForIdentity(identity.id)!;
  const dashboard = getDashboardForIdentity(identity.id)!;
  const practicum = usePracticumProgress(identity.id);
  const questionnaire = useQuestionnaireState(identity.id);
  const documentState = useDocumentState(identity.id);
  const documents = generateDocuments(identity.id, getQuestionnaireSummary(questionnaire.answers), documentState.state);
  const context = useMemo<AiContext>(() => buildAiContext({ identity, clientCase, dashboard, practicumProgress: practicum.progress, questionnaireProgress: questionnaire.progress, documents }), [identity, clientCase, dashboard, practicum.progress, questionnaire.progress, documents]);
  const { conversation, appendUser, appendReply, reset } = useAiConversation(identity.id, context);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { const log=endRef.current?.parentElement;log?.scrollTo({ top:log.scrollHeight, behavior:"smooth" }); }, [conversation.messages.length, typing]);

  function send(message: string) {
    if (typing) return;
    appendUser(message);
    setTyping(true);
    timer.current = setTimeout(async () => {
      const reply = await demoAssistant.reply({ context, message });
      appendReply(reply);
      setTyping(false);
      timer.current = null;
    }, 700);
  }
  function clearChat() { if (timer.current) clearTimeout(timer.current); timer.current = null; setTyping(false); reset(); }

  return <div className="flex min-w-0 flex-col gap-6 pt-6 sm:gap-8 sm:pt-0">
    <SectionHeader title={<>AI-помощник <IBuroBrand /></>} description="Поможет разобраться в текущем этапе и работе платформы." action={<Button type="button" variant="ghost" className="w-fit rounded-full" onClick={clearChat}><RotateCcw data-icon="inline-start" />Очистить чат</Button>} />
    <div className="flex gap-3 text-sm leading-6"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="font-semibold">Информационная поддержка</p><p className="mt-1 text-muted-foreground">AI-помощник помогает ориентироваться в материалах дела. Его ответы не являются юридическим заключением.</p></div></div>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <PlatformCard className="flex min-w-0 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-4 sm:p-5"><span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Bot className="size-5" aria-hidden="true" /></span><div><h2 className="font-semibold">Помощник <IBuroBrand /></h2><p className="text-xs text-muted-foreground">Контекст дела обновлён</p></div></div>
        <div role="log" aria-live="polite" aria-label="История диалога" className="max-h-[36rem] min-h-[24rem] min-w-0 space-y-5 overflow-y-auto p-3 sm:p-5">
          {conversation.messages.map((message) => <AiMessage key={message.id} message={message} />)}
          {typing ? <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground"><span className="grid size-9 place-items-center rounded-xl border border-border bg-muted"><Bot className="size-4" aria-hidden="true" /></span><span>AI-помощник печатает…</span></div> : null}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border px-3 py-4 sm:px-5"><p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Можно спросить</p><div className="flex flex-wrap gap-2">{AI_SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} disabled={typing} onClick={() => send(suggestion)} className="max-w-full rounded-full border border-border bg-background px-3 py-2 text-left text-xs leading-5 transition hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-50">{suggestion}</button>)}</div></div>
        <AiComposer disabled={typing} onSend={send} />
      </PlatformCard>
      <AiContextPanel context={context} />
    </div>
  </div>;
}
