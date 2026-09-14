"use client";

import { useTaskState, type TaskState } from "@/lib/platform/workflows/tasks/useTaskState";

export type ManagerTaskState = TaskState;

export function useManagerTaskState() {
  return useTaskState();
}
