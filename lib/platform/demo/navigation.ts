import type { PlatformNavItem } from "../types";

export const CLIENT_NAVIGATION: readonly PlatformNavItem[] = [
  { label: "Главная", href: "/app/client", icon: "home" },
  { label: "Практикум", href: "/app/client/practicum", icon: "book" }, { label: "Анкета", href: "/app/client/questionnaire", icon: "form" },
  { label: "Документы", href: "/app/client/documents", icon: "files" }, { label: "AI-помощник", href: "/app/client/ai", icon: "sparkles" },
  { label: "Мой прогресс", icon: "chart" }, { label: "Профиль", icon: "profile" },
];

export const LAWYER_NAVIGATION: readonly PlatformNavItem[] = [
  { label: "Рабочий стол", href: "/app/lawyer", icon: "home" },
  { label: "Клиенты", href: "/app/lawyer/cases", icon: "users" }, { label: "Дела", href: "/app/lawyer/cases", icon: "briefcase" },
  { label: "Задачи", icon: "tasks" }, { label: "Активность", icon: "activity" },
];
