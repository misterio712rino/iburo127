"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, RotateCcw, ShieldCheck } from "lucide-react";
import { PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { Button } from "@/components/ui/button";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { AiComposer } from "./AiComposer";
import { AiContextPanel } from "./AiContextPanel";
import { AiLockedState } from "./AiLockedState";
import { AiMessage } from "./AiMessage";
import {
  AiApiError,
  getAiCaseState,
  listPlatformCases,
  requestAiReply,
  type AiCaseState,
  type AiHistoryTurn,
} from "./production-api";
import { useAiConversation } from "./useAiConversation";

const AI_SUGGESTIONS = [
  "Что мне делать дальше?",
  "Какие документы уже готовы?",
  "Зачем нужна проверка юриста?",
  "Что означает мой текущий этап?",
  "Что будет после проверки документов?",
] as const;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; caseState: AiCaseState }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "no-case" }
  | { status: "unavailable" };

async function resolveClientAiCase(): Promise<AiCaseState | null> {
  const cases = await listPlatformCases();
  if (cases.length === 0) return null;

  let firstAccessibleState: AiCaseState | null = null;
  for (const clientCase of cases) {
    try {
      const state = await getAiCaseState(clientCase.id);
      firstAccessibleState ??= state;
      if (state.enabled) return state;
    } catch (error) {
      if (error instanceof AiApiError && (error.status === 404 || error.code === "NOT_FOUND")) {
        continue;
      }
      throw error;
    }
  }
  return firstAccessibleState;
}

function LoadingCard() {
  return (
    <PlatformCard className="p-6 sm:p-8">
      <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        Загружаем безопасный контекст дела…
      </div>
    </PlatformCard>
  );
}

function AccessState({ state }: { state: Exclude<LoadState["status"], "loading" | "ready"> }) {
  const copy = {
    unauthenticated: ["Требуется вход", "Войдите в личный кабинет, чтобы открыть AI-помощника."],
    forbidden: ["Раздел недоступен", "AI-помощник клиента доступен только в клиентской части платформы."],
    "no-case": ["Дело не найдено", "Для текущей учётной записи пока нет доступного клиентского дела."],
    unavailable: ["Сервис временно недоступен", "Не удалось получить данные AI-помощника. Попробуйте обновить страницу позже."],
  }[state];

  return (
    <PlatformCard className="p-6 sm:p-8">
      <h2 className="text-xl font-semibold">{copy[0]}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{copy[1]}</p>
    </PlatformCard>
  );
}

export function AiAssistant() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void resolveClientAiCase()
      .then((caseState) => {
        if (!active) return;
        setLoadState(caseState ? { status: "ready", caseState } : { status: "no-case" });
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof AiApiError && error.status === 401) {
          setLoadState({ status: "unauthenticated" });
        } else if (error instanceof AiApiError && error.status === 403) {
          setLoadState({ status: "forbidden" });
        } else {
          setLoadState({ status: "unavailable" });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PlatformShell>
      <div className="flex min-w-0 flex-col gap-6 pt-6 sm:gap-8 sm:pt-0">
        {loadState.status === "loading" ? <LoadingCard /> : null}
        {loadState.status !== "loading" && loadState.status !== "ready" ? (
          <AccessState state={loadState.status} />
        ) : null}
        {loadState.status === "ready" && !loadState.caseState.enabled ? (
          <AiLockedState planCode={loadState.caseState.planCode} />
        ) : null}
        {loadState.status === "ready" && loadState.caseState.enabled ? (
          <AiChat caseState={loadState.caseState} onCaseStateChange={(caseState) => setLoadState({ status: "ready", caseState })} />
        ) : null}
      </div>
    </PlatformShell>
  );
}

function AiChat({
  caseState,
  onCaseStateChange,
}: {
  caseState: AiCaseState;
  onCaseStateChange: (caseState: AiCaseState) => void;
}) {
  const { conversation, appendUser, appendReply, reset } = useAiConversation();
  const [typing, setTyping] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = endRef.current?.parentElement;
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [conversation.messages.length, typing]);

  async function send(message: string) {
    if (typing) return;
    const history: AiHistoryTurn[] = conversation.messages
      .filter((item) => item.id !== "welcome")
      .slice(-10)
      .map((item) => ({ role: item.role, content: item.content }));

    appendUser(message);
    setTyping(true);
    setRequestError(null);
    try {
      const reply = await requestAiReply(caseState.caseId, message, history);
      appendReply({ content: reply.content });
    } catch (error) {
      if (error instanceof AiApiError && error.code === "AI_FEATURE_NOT_AVAILABLE") {
        onCaseStateChange({ ...caseState, enabled: false });
        return;
      }
      if (error instanceof AiApiError && error.status === 401) {
        setRequestError("Сессия завершена. Войдите в личный кабинет повторно.");
      } else if (error instanceof AiApiError && error.status === 503) {
        setRequestError("AI-помощник временно недоступен. Ваше сообщение не было сохранено сервером.");
      } else {
        setRequestError("Не удалось получить ответ. Попробуйте отправить сообщение ещё раз.");
      }
    } finally {
      setTyping(false);
    }
  }

  function clearChat() {
    reset();
    setRequestError(null);
  }

  return (
    <>
      <SectionHeader
        title={<>AI-помощник <IBuroBrand /></>}
        description="Поможет разобраться в текущем этапе и работе платформы."
        action={
          <Button type="button" variant="ghost" className="w-fit rounded-full" onClick={clearChat}>
            <RotateCcw data-icon="inline-start" />
            Очистить чат
          </Button>
        }
      />
      <div className="flex gap-3 text-sm leading-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold">Информационная поддержка</p>
          <p className="mt-1 text-muted-foreground">
            AI-помощник помогает ориентироваться в материалах дела. Его ответы не являются окончательным юридическим заключением. История этого чата не сохраняется в localStorage.
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <PlatformCard className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border p-4 sm:p-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">Помощник <IBuroBrand /></h2>
              <p className="text-xs text-muted-foreground">Контекст дела получен с сервера</p>
            </div>
          </div>
          <div role="log" aria-live="polite" aria-label="История диалога" className="max-h-[36rem] min-h-[24rem] min-w-0 space-y-5 overflow-y-auto p-3 sm:p-5">
            {conversation.messages.map((message) => <AiMessage key={message.id} message={message} />)}
            {typing ? (
              <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-muted">
                  <Bot className="size-4" aria-hidden="true" />
                </span>
                <span>AI-помощник формирует ответ…</span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          {requestError ? (
            <div role="alert" className="border-t border-border bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-5">
              {requestError}
            </div>
          ) : null}
          <div className="border-t border-border px-3 py-4 sm:px-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Можно спросить</p>
            <div className="flex flex-wrap gap-2">
              {AI_SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  disabled={typing}
                  onClick={() => void send(suggestion)}
                  className="max-w-full rounded-full border border-border bg-background px-3 py-2 text-left text-xs leading-5 transition hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <AiComposer disabled={typing} onSend={(message) => void send(message)} />
        </PlatformCard>
        <AiContextPanel context={caseState} />
      </div>
    </>
  );
}
