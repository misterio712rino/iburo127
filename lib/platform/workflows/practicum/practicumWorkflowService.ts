import {
  getPracticumServerSnapshot,
  persistCompletedLessonIds,
  readCompletedLessonIds,
  subscribePracticumState,
} from "@/lib/platform/workflows/practicum/demoPracticumAdapter";

export interface PracticumWorkflowService {
  read(identityId: string): string[];
  getServerSnapshot(identityId: string): string;
  subscribe(callback: () => void): () => void;
  completeLesson(identityId: string, completedLessonIds: readonly string[], lessonId: string): void;
}

class DemoPracticumWorkflowService implements PracticumWorkflowService {
  read(identityId: string) {
    return readCompletedLessonIds(identityId);
  }

  getServerSnapshot(identityId: string) {
    return getPracticumServerSnapshot(identityId);
  }

  subscribe(callback: () => void) {
    return subscribePracticumState(callback);
  }

  completeLesson(identityId: string, completedLessonIds: readonly string[], lessonId: string) {
    if (completedLessonIds.includes(lessonId)) return;
    persistCompletedLessonIds(identityId, [...completedLessonIds, lessonId]);
  }
}

export const practicumWorkflowService: PracticumWorkflowService =
  new DemoPracticumWorkflowService();
