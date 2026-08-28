export const AI_ASSISTANT_FEATURE_CODE = "AI_ASSISTANT";
export const AI_INVALID_REQUEST = "AI_INVALID_REQUEST";
export const AI_CASE_NOT_FOUND = "AI_CASE_NOT_FOUND";
export const AI_ACCESS_DENIED = "AI_ACCESS_DENIED";
export const AI_FEATURE_NOT_AVAILABLE = "AI_FEATURE_NOT_AVAILABLE";
export const AI_MODEL_RESPONSE_INVALID = "AI_MODEL_RESPONSE_INVALID";
export const AI_RATE_LIMITED = "AI_RATE_LIMITED";
export const AI_AUDIT_FAILED = "AI_AUDIT_FAILED";

export type AiConversationRole = "user" | "assistant";

export type AiConversationTurn = {
  role: AiConversationRole;
  content: string;
};

export type AiReplyRequest = {
  message: string;
  history: readonly AiConversationTurn[];
};

export type AiCaseContext = {
  planCode: string;
  stageCode: string;
  caseStatus: string;
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
  featureCodes: readonly string[];
};

export type AiAssistantCaseState = {
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
  taskSummary: AiCaseContext["taskSummary"];
  readyFileCount: number;
};

export interface AiCaseContextRepository {
  loadCaseContext(clientCaseId: string): Promise<AiCaseContext | null>;
}

export type AiModelInput = {
  instructions: string;
  messages: readonly AiConversationTurn[];
  safetyIdentifier: string;
};

export interface AiModelGateway {
  reply(input: AiModelInput): Promise<string>;
}

export type AiAuditOutcome = "completed" | "restricted" | "failed";

export type AiUsageReservation = {
  auditId: string;
};

export interface AiUsageLedger {
  reserveRequest(input: {
    clientCaseId: string;
    actorUserId: string;
    now: Date;
  }): Promise<AiUsageReservation | null>;
  recordOutcome(input: {
    clientCaseId: string;
    actorUserId: string;
    auditId: string;
    outcome: AiAuditOutcome;
  }): Promise<void>;
}

export type AiAssistantReply = {
  content: string;
  restrictedAction: boolean;
};
