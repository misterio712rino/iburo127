export type PlanCode = "LITE" | "PRO" | "INDIVIDUAL";
export type PlatformTheme = "light" | "pro" | "premium" | "staff";
export type DemoRole = "CLIENT" | "LAWYER" | "MANAGER";

export type DemoIdentity = {
  id: string;
  displayName: string;
  role: DemoRole;
  initials: string;
  plan?: PlanCode;
  caseNumber?: string;
};

export type DemoClientCase = {
  caseNumber: string;
  clientId: string;
  plan: PlanCode;
  stage: string;
  status: "Активно";
  progress: number;
  nextStep: string;
  assignedEmployeeId: string;
  assignedLawyer: string;
  openedDate: string;
};

export type PlatformNavItem = {
  label: string;
  href?: string;
  icon: "home" | "book" | "form" | "files" | "sparkles" | "chart" | "profile" | "users" | "briefcase" | "tasks" | "activity";
};

export type DashboardModuleCode =
  | "PRACTICUM"
  | "QUESTIONNAIRE"
  | "DOCUMENTS"
  | "CASE_PROGRESS"
  | "MORTGAGE"
  | "AI_ASSISTANT";

export type DashboardModuleState = "completed" | "active" | "upcoming" | "locked";

export type DashboardModule = {
  code: DashboardModuleCode;
  title: string;
  summary: string;
  detail: string;
  progress?: number;
  state: DashboardModuleState;
  lockLabel?: string;
};

export type DashboardNextStep = {
  title: string;
  description: string;
  actionLabel: string;
};

export type DashboardActivity = {
  id: string;
  text: string;
  dateLabel: string;
  type: "lesson" | "questionnaire" | "document" | "lawyer";
};

export type ClientDashboardData = {
  identityId: string;
  currentStageIndex: number;
  nextStep: DashboardNextStep;
  modules: readonly DashboardModule[];
  activity: readonly DashboardActivity[];
  supportDescription: string;
};

export type LessonStatus = "completed" | "current" | "available" | "locked";

export type PracticumLesson = {
  id: string;
  number: number;
  moduleId: string;
  title: string;
  duration: string;
  introduction: string;
  paragraphs: readonly string[];
  keyPoints: readonly string[];
  nextText: string;
};

export type PracticumModule = {
  id: string;
  number: number;
  title: string;
  description: string;
  lessonIds: readonly string[];
};

export type ClientPracticumState = {
  identityId: string;
  initialCompletedLessonIds: readonly string[];
};

export type QuestionnaireFieldType = "text" | "number" | "currency" | "date" | "select" | "radio" | "yes-no" | "textarea";
export type QuestionnaireAnswer = string | number | boolean;
export type QuestionnaireAnswers = Record<string, QuestionnaireAnswer>;
export type QuestionnaireCondition = { fieldId: string; equals: QuestionnaireAnswer };
export type QuestionnaireField = {
  id: string;
  label: string;
  type: QuestionnaireFieldType;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  hint?: string;
  visibleWhen?: QuestionnaireCondition;
};
export type QuestionnaireSection = {
  id: string;
  number: number;
  title: string;
  description: string;
  fields: readonly QuestionnaireField[];
  review?: boolean;
};
export type ClientQuestionnaireSeed = {
  identityId: string;
  started: boolean;
  initialCompletedSectionIds: readonly string[];
  initialAnswers: QuestionnaireAnswers;
};
export type QuestionnaireSectionStatus = "completed" | "current" | "available";

export type DocumentStatus = "waiting_data" | "draft" | "ready_for_review" | "reviewed" | "sent_for_review";
export type DocumentDefinition = {
  id: string;
  title: string;
  description: string;
  requiredFieldIds: readonly string[];
};
export type DocumentPreviewField = { label: string; value: string; source?: string };
export type DocumentPreviewSection = { title: string; fields: readonly DocumentPreviewField[]; note?: string };
export type GeneratedDocument = {
  definition: DocumentDefinition;
  status: DocumentStatus;
  completeness: number;
  updatedAt: string;
  sections: readonly DocumentPreviewSection[];
  usedSources: readonly string[];
};
export type ClientDocumentState = {
  regeneratedAtById: Record<string, string>;
  sentForReviewIds: readonly string[];
  reviewedAtById: Record<string, string>;
};

export type LawyerPriority = "routine" | "medium" | "high";
export type LawyerCaseSummary = {
  identity: DemoIdentity;
  clientCase: DemoClientCase;
  practicum: { completedCount: number; progress: number; currentLessonTitle?: string };
  questionnaire: { completedCount: number; progress: number; currentSectionTitle: string; isComplete: boolean };
  documents: readonly GeneratedDocument[];
  priority: LawyerPriority;
  attentionReason: string;
  lastActivity: string;
};

export type AiRole = "user" | "assistant";
export type AiActionType = "OPEN_DOCUMENTS" | "OPEN_QUESTIONNAIRE" | "OPEN_PRACTICUM";
export type AiAction = { type: AiActionType; label: string; href?: string };
export type AiMessage = { id: string; role: AiRole; content: string; createdAt: string; action?: AiAction };
export type AiConversation = { createdAt: string; messages: AiMessage[]; escalatedAt?: string };
export type AiDocumentContext = { readyCount: number; draftCount: number; waitingCount: number; readyTitles: readonly string[] };
export type AiContext = {
  identityId: string;
  displayName: string;
  firstName: string;
  plan: PlanCode;
  caseNumber: string;
  currentStage: string;
  overallProgress: number;
  nextStep: string;
  practicumProgress: number;
  questionnaireProgress: number;
  documents: AiDocumentContext;
  assignedLawyer: string;
  availableFeatures: readonly string[];
};
export type AiReply = { content: string; action?: AiAction };
export type AiReplyInput = { context: AiContext; message: string };
export interface AiAssistantProvider { reply(input: AiReplyInput): Promise<AiReply>; }
