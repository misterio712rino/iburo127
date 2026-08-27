"use client";

import { useSyncExternalStore } from "react";
import type { DemoTaskStatus } from "@/lib/platform/demo/tasks";

export type ManagerTaskState = Record<string, DemoTaskStatus>;
const STORAGE_KEY = "iburo.tasks.v1";
const EVENT_NAME = "iburo-task-state";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_NAME, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT_NAME, callback); };
}

export function useManagerTaskState() {
  const stored = useSyncExternalStore(subscribe, () => window.localStorage.getItem(STORAGE_KEY) ?? "", () => "");
  let state: ManagerTaskState = {};
  try { if (stored) state = JSON.parse(stored) as ManagerTaskState; } catch {}
  function update(id: string, status: DemoTaskStatus) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, [id]: status }));
    window.dispatchEvent(new Event(EVENT_NAME));
  }
  return { state, statusOf: (id: string) => state[id] ?? "new", update };
}
