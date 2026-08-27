export const PRACTICUM_NOT_FOUND = "PRACTICUM_NOT_FOUND";
export const PRACTICUM_VERSION_CONFLICT = "PRACTICUM_VERSION_CONFLICT";

export type PracticumProgressRecord = {
  clientCaseId: string;
  completedLessonIds: readonly string[];
  startedAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export interface PracticumProgressRepository {
  getByClientCaseId(clientCaseId: string): Promise<PracticumProgressRecord | null>;
  createForCase(clientCaseId: string): Promise<PracticumProgressRecord>;
  completeLesson(input: {
    clientCaseId: string;
    lessonId: string;
    expectedVersion?: number;
    isFinalLesson?: boolean;
  }): Promise<PracticumProgressRecord>;
}
