"use client";

export type PlatformCaseRecord = {
  id: string;
  caseNumber: string;
  planCode: string;
  stageCode: string;
  status: string;
};

export type AiCaseState = {
  caseId: string;
  caseNumber: string;
  planCode: string;
  stageCode: string;
  caseStatus: string;
  enabled: boolean;
  questionnaireStatus: string | null;
  questionnaireCompletedSections: number;
  practicumStatus: string | null;
  practicumCompletedLessons: number;
  documents: readonly { code: string; status: string }[];
  taskSummary: {
    newCount: number;
    workingCount: number;
    doneCount: number;
    overdueCount: number;
  };
  readyFileCount: number;
};

export type AiHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AiServerReply = {
  content: string;
  restrictedAction: boolean;
};

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string } };

export class AiApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new AiApiError("NETWORK_ERROR", 0);
  }

  let body: ApiEnvelope<T> | undefined;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new AiApiError("INVALID_RESPONSE", response.status);
  }

  if (!response.ok || !body.ok) {
    throw new AiApiError(
      !body.ok ? body.error?.code ?? "REQUEST_FAILED" : "REQUEST_FAILED",
      response.status,
    );
  }
  return body.data;
}

export function listPlatformCases() {
  return requestJson<readonly PlatformCaseRecord[]>("/api/platform/cases");
}

export function getAiCaseState(caseId: string) {
  return requestJson<AiCaseState>(
    `/api/platform/cases/${encodeURIComponent(caseId)}/ai`,
  );
}

export function requestAiReply(
  caseId: string,
  message: string,
  history: readonly AiHistoryTurn[],
) {
  return requestJson<AiServerReply>(
    `/api/platform/cases/${encodeURIComponent(caseId)}/ai`,
    {
      method: "POST",
      body: JSON.stringify({ message, history }),
    },
  );
}
