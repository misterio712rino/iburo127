"use client";

import { useSyncExternalStore } from "react";
import { getInitialAiMessage } from "@/lib/platform/ai";
import type { AiContext, AiConversation, AiMessage, AiReply } from "@/lib/platform/types";

const STORAGE_PREFIX = "iburo.demo.ai.v1.";
const EVENT_NAME = "iburo-ai-conversation";
const serverSnapshots = new Map<string, string>();

function initialConversation(context: AiContext): AiConversation {
  return { createdAt: "2026-01-24T15:00:00+03:00", messages: [{ id: "welcome", role: "assistant", content: getInitialAiMessage(context), createdAt: "2026-01-24T15:00:00+03:00" }] };
}
function read(identityId: string, context: AiContext) { try { const value = window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`); return value ? JSON.parse(value) as AiConversation : initialConversation(context); } catch { return initialConversation(context); } }
function subscribe(callback: () => void) { window.addEventListener(EVENT_NAME, callback); window.addEventListener("storage", callback); return () => { window.removeEventListener(EVENT_NAME, callback); window.removeEventListener("storage", callback); }; }
function persist(identityId: string, conversation: AiConversation) { window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`, JSON.stringify(conversation)); window.dispatchEvent(new Event(EVENT_NAME)); }
function id(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export function useAiConversation(identityId: string, context: AiContext) {
  const fallback = JSON.stringify(initialConversation(context));
  if (!serverSnapshots.has(identityId)) serverSnapshots.set(identityId, fallback);
  const serialized = useSyncExternalStore(subscribe, () => JSON.stringify(read(identityId, context)), () => serverSnapshots.get(identityId) ?? fallback);
  const conversation = JSON.parse(serialized) as AiConversation;
  function mutate(update: (current: AiConversation) => AiConversation) { persist(identityId, update(read(identityId, context))); }
  return {
    conversation,
    appendUser(content: string) { const message: AiMessage = { id: id("user"), role: "user", content, createdAt: new Date().toISOString() }; mutate((current) => ({ ...current, messages: [...current.messages, message] })); },
    appendReply(reply: AiReply) { const message: AiMessage = { id: id("assistant"), role: "assistant", content: reply.content, action: reply.action, createdAt: new Date().toISOString() }; mutate((current) => ({ ...current, messages: [...current.messages, message] })); },
    escalate() { mutate((current) => ({ ...current, escalatedAt: new Date().toISOString() })); },
    reset() { persist(identityId, initialConversation(context)); },
  };
}
