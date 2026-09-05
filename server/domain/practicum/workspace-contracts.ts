export const PRACTICUM_WORKSPACE_NOT_FOUND = "PRACTICUM_WORKSPACE_NOT_FOUND";
export const PRACTICUM_WORKSPACE_FORBIDDEN = "PRACTICUM_WORKSPACE_FORBIDDEN";
export const PRACTICUM_WORKSPACE_INVALID_LESSON = "PRACTICUM_WORKSPACE_INVALID_LESSON";
export const PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED = "PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED";
export const PRACTICUM_WORKSPACE_INVALID_HOMEWORK = "PRACTICUM_WORKSPACE_INVALID_HOMEWORK";
export const PRACTICUM_WORKSPACE_INVALID_MESSAGE = "PRACTICUM_WORKSPACE_INVALID_MESSAGE";

export const PRACTICUM_HOMEWORK_STATUSES = [
  "NOT_STARTED",
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "ACCEPTED",
] as const;

export type PracticumHomeworkStatus = (typeof PRACTICUM_HOMEWORK_STATUSES)[number];
export type PracticumHomeworkReviewDecision = "CHANGES_REQUESTED" | "ACCEPTED";

export type PracticumHomeworkRecord = {
  id: string;
  clientCaseId: string;
  lessonId: string;
  status: PracticumHomeworkStatus;
  draftText: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PracticumHomeworkRevisionRecord = {
  id: string;
  homeworkId: string;
  revisionNumber: number;
  submittedByUserId: string;
  answerText: string;
  submittedAt: Date;
  reviewedByUserId: string | null;
  reviewDecision: PracticumHomeworkReviewDecision | null;
  reviewComment: string | null;
  reviewedAt: Date | null;
};

export type PracticumLessonMessageRecord = {
  id: string;
  clientCaseId: string;
  lessonId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
};

export type PracticumLessonWorkspaceRecord = {
  homework: PracticumHomeworkRecord | null;
  revisions: readonly PracticumHomeworkRevisionRecord[];
  messages: readonly PracticumLessonMessageRecord[];
};

export interface PracticumWorkspaceRepository {
  getLessonWorkspace(input: {
    clientCaseId: string;
    lessonId: string;
  }): Promise<PracticumLessonWorkspaceRecord>;

  saveHomeworkDraft(input: {
    clientCaseId: string;
    lessonId: string;
    answerText: string;
    actorUserId: string;
  }): Promise<PracticumHomeworkRecord>;

  submitHomework(input: {
    clientCaseId: string;
    lessonId: string;
    answerText: string;
    actorUserId: string;
  }): Promise<PracticumLessonWorkspaceRecord>;

  reviewHomework(input: {
    clientCaseId: string;
    lessonId: string;
    decision: PracticumHomeworkReviewDecision;
    comment: string;
    actorUserId: string;
  }): Promise<PracticumLessonWorkspaceRecord>;

  addLessonMessage(input: {
    clientCaseId: string;
    lessonId: string;
    body: string;
    actorUserId: string;
  }): Promise<PracticumLessonMessageRecord>;
}
