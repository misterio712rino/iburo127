"use client";

import { useState } from "react";
import type { AiConversation, AiMessage, AiReply } from "@/lib/platform/types";

const WELCOME_MESSAGE =
  "Здравствуйте. Я помогу сориентироваться по текущему этапу дела и материалам платформы. Я не принимаю юридически значимые решения и не совершаю действия от вашего имени.";

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialConversation(): AiConversation {
  const createdAt = new Date().toISOString();
  return {
    createdAt,
    messages: [
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME_MESSAGE,
        createdAt,
      },
    ],
  };
}

export function useAiConversation() {
  const [conversation, setConversation] = useState<AiConversation>(initialConversation);

  return {
    conversation,
    appendUser(content: string) {
      const message: AiMessage = {
        id: id("user"),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setConversation((current) => ({
        ...current,
        messages: [...current.messages, message],
      }));
    },
    appendReply(reply: AiReply) {
      const message: AiMessage = {
        id: id("assistant"),
        role: "assistant",
        content: reply.content,
        action: reply.action,
        createdAt: new Date().toISOString(),
      };
      setConversation((current) => ({
        ...current,
        messages: [...current.messages, message],
      }));
    },
    reset() {
      setConversation(initialConversation());
    },
  };
}
