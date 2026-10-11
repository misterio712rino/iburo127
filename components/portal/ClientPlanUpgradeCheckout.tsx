"use client";

import { useRef, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

type CheckoutResponse = {
  ok?: boolean;
  checkoutUrl?: unknown;
  error?: { code?: unknown };
};

const ERROR_COPY: Record<string, string> = {
  COMMERCE_CASE_CHECKOUT_PENDING: "По этому делу уже оформляется платёж. Продолжите текущую оплату или дождитесь окончания её сессии.",
  COMMERCE_CASE_PLAN_UNCHANGED: "У дела уже подключён этот тариф.",
  CHECKOUT_IDEMPOTENCY_CONFLICT: "Не удалось восстановить текущий запрос. Обновите страницу и попробуйте ещё раз.",
  RATE_LIMITED: "Слишком много попыток. Подождите немного и повторите.",
  UNAUTHENTICATED: "Сессия завершилась. Войдите в кабинет и повторите действие.",
  COMMERCE_CHECKOUT_NO_LONGER_PENDING: "Предыдущая попытка оплаты завершена. Нажмите ещё раз, чтобы создать новую оплату.",
  COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED: "Не удалось безопасно подтвердить статус платёжной сессии. Обратитесь в поддержку; не запускайте оплату повторно.",
  FORBIDDEN: "У вас нет доступа к оплате по этому делу.",
};

function checkoutRequestStorageKey(caseId: string) {
  return `iburo:commerce-checkout:${caseId}:PRO`;
}

function checkoutRequestId(caseId: string) {
  const key = checkoutRequestStorageKey(caseId);
  const saved = sessionStorage.getItem(key);
  if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;

  const requestId = crypto.randomUUID();
  sessionStorage.setItem(key, requestId);
  return requestId;
}

export function ClientPlanUpgradeCheckout({
  caseId,
  caseDisplayNumber,
  checkoutAvailable,
}: {
  caseId: string;
  caseDisplayNumber: string;
  checkoutAvailable: boolean;
}) {
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!checkoutAvailable) return null;

  async function startCheckout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setErrorMessage(null);

    try {
      requestId.current ??= checkoutRequestId(caseId);
      const response = await fetch("/api/public/commerce/checkout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCaseId: caseId,
          planCode: "PRO",
          requestId: requestId.current,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;
      if (!response.ok || payload?.ok !== true || typeof payload.checkoutUrl !== "string") {
        const code = typeof payload?.error?.code === "string" ? payload.error.code : "";
        if (code === "COMMERCE_CHECKOUT_NO_LONGER_PENDING") {
          sessionStorage.removeItem(checkoutRequestStorageKey(caseId));
          requestId.current = null;
        }
        throw new Error(ERROR_COPY[code] ?? "Не удалось открыть оплату. Попробуйте ещё раз позже.");
      }

      const checkoutUrl = new URL(payload.checkoutUrl);
      if (checkoutUrl.protocol !== "https:") {
        throw new Error("Получена небезопасная ссылка на оплату.");
      }
      window.location.assign(checkoutUrl.href);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть оплату. Попробуйте ещё раз позже.");
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--ib-plan-accent)]/20 bg-card p-5 shadow-sm sm:p-7" aria-labelledby="plan-upgrade-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ib-plan-accent)]">Тариф по делу</p>
          <h2 id="plan-upgrade-title" className="mt-2 text-xl font-bold text-foreground">Перейти с Лайт на PRO</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Проверка документов и поддержка специалиста. Итоговая сумма отобразится на защищённой странице оплаты.</p>
        </div>
        <button
          type="button"
          onClick={startCheckout}
          disabled={pending}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--ib-plan-accent)] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ib-plan-accent)]/25 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Переходим к оплате…" : "Перейти к оплате"}
          {!pending ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </button>
      </div>
      {errorMessage ? <p className="mt-4 text-sm font-medium text-destructive" role="alert">{errorMessage}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">Платёж будет привязан к делу {caseDisplayNumber} после подтверждения Stripe.</p>
    </section>
  );
}
