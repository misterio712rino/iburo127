"use client";

import { useSyncExternalStore } from "react";
import type { DemoTaskStatus } from "@/lib/platform/demo/tasks";

export type TaskState = Record<string, DemoTaskStatus>;

const STORAGE_KEY = "iburo.tasks.v1";
const EVENT_NAME = "iburo-task-state";
const EMPTY_STATE: TaskState = {};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_NAME, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_NAME, callback);
  };
}

function parseState(serialized: string): TaskState {
  if (!serialized) return EMPTY_STATE;

  try {
    const value = JSON.parse(serialized) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_STATE;

    const next: TaskState = {};
    for (const [taskId, status] of Object.entries(value)) {
      if (status === "new" || status === "working" || status === "done") {
        next[taskId] = status;
      }
    }
    return next;
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(state: TaskState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useTaskState() {
  const serialized = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_KEY) ?? "",
    () => "",
  );
  const state = parseState(serialized);

  function statusOf(taskId: string): DemoTaskStatus {
    return state[taskId] ?? "new";
  }

  function update(taskId: string, status: DemoTaskStatus) {
    writeState({ ...state, [taskId]: status });
  }

  return { state, statusOf, update };
}
