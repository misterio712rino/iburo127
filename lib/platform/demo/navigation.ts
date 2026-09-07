import type { PlatformNavItem } from "../types";

export const CLIENT_NAVIGATION: readonly PlatformNavItem[] = [
  { label: "Главная", href: "/app/client", icon: "home" },
  { label: "Практикум", href: "/app/client/practicum", icon: "book" }, { label: "Анкета", href: "/app/client/questionnaire", icon: "form" },
  { label: "Документы", href: "/app/client/documents", icon: "files" }, { label: "AI-помощник", href: "/app/client/ai", icon: "sparkles" },
  { label: "Мой прогресс", href: "/app/client/progress", icon: "chart" }, { label: "Профиль", href: "/app/client/profile", icon: "profile" },
];

export const LAWYER_NAVIGATION: readonly PlatformNavItem[] = [
  { label: "Рабочий стол", href: "/app/lawyer", icon: "home" },
  { label: "Клиенты", href: "/app/lawyer/clients", icon: "users" }, { label: "Дела", href: "/app/lawyer/cases", icon: "briefcase" },
  { label: "Задачи", href: "/app/lawyer/tasks", icon: "tasks" }, { label: "Активность", href: "/app/lawyer/activity", icon: "activity" },
];

export const MANAGER_NAVIGATION: readonly PlatformNavItem[] = [
  { label: "Рабочий стол", href: "/app/manager", icon: "home" },
  { label: "Клиенты", href: "/app/manager/clients", icon: "users" },
  { label: "Команда", href: "/app/manager/team", icon: "profile" },
  { label: "Дела", href: "/app/manager/cases", icon: "briefcase" },
  { label: "Задачи", href: "/app/manager/tasks", icon: "tasks" },
  { label: "Активность", href: "/app/manager/activity", icon: "activity" },
];
