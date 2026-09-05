"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  Files,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";

import { DOCUMENT_DEFINITIONS } from "@/lib/platform/document-definitions";
import styles from "./IBuroDocumentsV2.module.css";

type DocumentStatus = "WAITING_DATA" | "DRAFT" | "READY_FOR_REVIEW" | "SENT_FOR_REVIEW" | "REVIEWED";
type DocumentView = { id: string; documentCode: string; status: DocumentStatus; regeneratedAt: string | null; sentForReviewAt: string | null; reviewedAt: string | null; version: number };
type ApiFailure = { ok: false; error: { code: string } };
type ApiSuccess<T> = { ok: true; data: T };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const STATUS_LABELS: Record<DocumentStatus, string> = {
  WAITING_DATA: "Ожидает данные",
  DRAFT: "Черновик",
  READY_FOR_REVIEW: "Готов к проверке",
  SENT_FOR_REVIEW: "На проверке",
  REVIEWED: "Проверен",
};

export function IBuroDocumentsV2({ caseId, questionnaire, initialDocuments }: {
  caseId: string;
  questionnaire: { completed: number; total: number; percent: number };
  initialDocuments: DocumentView[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byCode = useMemo(() => new Map(documents.map((document) => [document.documentCode, document])), [documents]);

  async function refreshDocuments() {
    const response = await fetch(`/api/platform/cases/${caseId}/documents`, { method: "GET", cache: "no-store" });
    const result = (await response.json()) as ApiResult<DocumentView[]>;
    if (!result.ok) throw new Error(result.error.code);
    setDocuments(result.data);
  }

  async function mutate(documentCode: string, action: "create" | "regenerate" | "send") {
    if (pendingKey) return;
    const current = byCode.get(documentCode);
    const pending = `${documentCode}:${action}`;
    setPendingKey(pending);
    setError(null);
    const suffix = action === "create" ? "" : action === "regenerate" ? "/regenerate" : "/send-for-review";
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/documents/${documentCode}${suffix}`, {
        method: "POST",
        headers: action === "create" ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
        body: action === "create" ? undefined : JSON.stringify({ expectedVersion: current?.version }),
      });
      const result = (await response.json()) as ApiResult<DocumentView>;
      if (!result.ok) {
        if (response.status === 409) {
          await refreshDocuments();
          setError(result.error.code === "VERSION_CONFLICT" ? "Документ изменился в другой вкладке. Состояние обновлено — повторите действие." : "Состояние документа изменилось. Список обновлён.");
          return;
        }
        throw new Error(result.error.code);
      }
      setDocuments((previous) => [...previous.filter((item) => item.documentCode !== documentCode), result.data]);
    } catch {
      setError("Не удалось изменить состояние документа. Повторите попытку.");
    } finally {
      setPendingKey(null);
    }
  }

  const prepared = documents.filter((document) => ["READY_FOR_REVIEW", "SENT_FOR_REVIEW", "REVIEWED"].includes(document.status)).length;
  const reviewed = documents.filter((document) => document.status === "REVIEWED").length;
  const heroTitle = prepared > 0 ? `${prepared} ${prepared === 1 ? "документ подготовлен" : prepared < 5 ? "документа подготовлены" : "документов подготовлены"}` : documents.length ? "Подготовка документов продолжается" : "Документы пока не сформированы";
  const heroText = questionnaire.percent < 100 ? `Анкета заполнена на ${questionnaire.percent}%. Комплект будет становиться полнее по мере заполнения данных.` : prepared ? "Проверьте подготовленные материалы и передайте готовые документы специалисту." : "Анкета заполнена. Можно начать формирование черновиков.";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>Материалы дела</span><h1>Документы</h1><p>Черновики формируются из актуальных данных анкеты. Перед использованием их проверяет специалист.</p></div>
        <div className={styles.headerStats}><strong>{reviewed}</strong><span>проверено</span></div>
      </header>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <section className={styles.hero}>
        <span>Подготовка документов</span><h2>{heroTitle}</h2><p>{heroText}</p><Files aria-hidden="true" />
      </section>

      <section aria-labelledby="docs-v2-list">
        <div className={styles.sectionHeading}><div><h2 id="docs-v2-list">Комплект документов</h2><p>Статусы обновляются вместе с данными анкеты и действиями специалиста.</p></div><span>{DOCUMENT_DEFINITIONS.length} документа</span></div>
        <div className={styles.cards}>
          {DOCUMENT_DEFINITIONS.map((definition) => {
            const document = byCode.get(definition.id);
            const status = document?.status;
            const completeness = status === "WAITING_DATA" ? Math.min(questionnaire.percent, 60) : document ? Math.max(questionnaire.percent, 75) : questionnaire.percent;
            const pending = pendingKey?.startsWith(`${definition.id}:`) ?? false;
            return (
              <article className={styles.card} key={definition.id}>
                <div className={styles.cardTop}><span className={styles.icon}><FileText aria-hidden="true" /></span><span className={`${styles.status} ${status ? styles[`status_${status}`] : ""}`}>{status ? STATUS_LABELS[status] : "Не создан"}</span></div>
                <h3>{definition.title}</h3><p>{definition.description}</p>
                <div className={styles.sourceRow}><span>Данные источника</span><strong>{completeness}%</strong></div>
                <div className={styles.track} role="progressbar" aria-label={`Готовность данных: ${definition.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completeness}><span style={{ width: `${completeness}%` }} /></div>
                <div className={styles.actions}>
                  {!document ? <Action label="Создать черновик" pending={pendingKey === `${definition.id}:create`} disabled={Boolean(pendingKey)} onClick={() => mutate(definition.id, "create")} /> : null}
                  {document && status !== "SENT_FOR_REVIEW" && status !== "REVIEWED" ? <Action label="Обновить по анкете" pending={pendingKey === `${definition.id}:regenerate`} disabled={Boolean(pendingKey)} onClick={() => mutate(definition.id, "regenerate")} icon="refresh" /> : null}
                  {status === "READY_FOR_REVIEW" ? <Action label="Передать на проверку" pending={pendingKey === `${definition.id}:send`} disabled={Boolean(pendingKey)} onClick={() => mutate(definition.id, "send")} icon="send" primary /> : null}
                </div>
                {status === "WAITING_DATA" ? <small className={styles.waiting}>Для подготовки пока недостаточно данных анкеты.</small> : null}
                {status === "SENT_FOR_REVIEW" ? <small className={styles.reviewing}><ShieldCheck aria-hidden="true" />Документ у специалиста на проверке.</small> : null}
                {status === "REVIEWED" ? <small className={styles.reviewed}><CheckCircle2 aria-hidden="true" />Проверка специалистом завершена.</small> : null}
                {pending ? <span className="sr-only" role="status">Выполняется действие с документом</span> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.bottomGrid}>
        <article><span className={styles.icon}><FileCheck2 aria-hidden="true" /></span><div><h3>Данные анкеты</h3><p>Заполнено {questionnaire.completed} из {questionnaire.total} разделов</p><div className={styles.track}><span style={{ width: `${questionnaire.percent}%` }} /></div><Link href={`/portal/cases/${caseId}/questionnaire`}>Открыть анкету <ArrowRight aria-hidden="true" /></Link></div></article>
        <article><span className={styles.icon}><ShieldCheck aria-hidden="true" /></span><div><h3>Проверка специалистом</h3><p>Автоматически подготовленный черновик не является готовым судебным документом. Специалист проверит содержание перед использованием.</p></div></article>
      </section>
    </div>
  );
}

function Action({ label, pending, disabled, onClick, icon, primary }: { label: string; pending: boolean; disabled: boolean; onClick: () => void; icon?: "refresh" | "send"; primary?: boolean }) {
  const Icon = pending ? Loader2 : icon === "refresh" ? RefreshCw : icon === "send" ? Send : FileText;
  return <button type="button" className={`${styles.action} ${primary ? styles.actionPrimary : ""}`} onClick={onClick} disabled={disabled} aria-busy={pending}><Icon className={pending ? styles.spin : ""} aria-hidden="true" />{pending ? "Подождите…" : label}</button>;
}
