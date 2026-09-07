import type { DemoClientCase, DemoIdentity } from "../types";
import { DEMO_CASES } from "./cases";
import { getSeededDocumentReadiness } from "./documents";
import { getDemoIdentity } from "./identities";
import { getPracticumProgress } from "./practicum";
import { getQuestionnaireProgress } from "./questionnaire";

export type ManagerAttention = "normal" | "attention" | "high";

export type ManagerEmployee = {
  id: string;
  displayName: string;
  initials: string;
  title: string;
};

export type ManagerClient = {
  identity: DemoIdentity;
  clientCase: DemoClientCase;
  employeeId: string;
  attention: ManagerAttention;
  practicumProgress: number;
  questionnaireProgress: number;
  documentReadiness: number;
  readinessSource: "canonical" | "presentation-seed";
  lastActivity: string;
};

export type ManagerActivityEvent = {
  id: string;
  category: "clients" | "documents" | "tasks" | "system" | "employees";
  title: string;
  clientId?: string;
  employeeId?: string;
  timestamp: string;
  period: "today" | "yesterday" | "week";
};

export const MANAGER_EMPLOYEES: readonly ManagerEmployee[] = [
  { id: "anna-lawyer", displayName: "Анна Орлова", initials: "АО", title: "Юрист" },
  { id: "sergey-lawyer", displayName: "Сергей Власов", initials: "СВ", title: "Старший юрист" },
];

type ManagerReadinessSeed = { practicumProgress: number; questionnaireProgress: number; documentReadiness: number };
type ManagerPortfolioSeed = {
  id: string;
  displayName?: string;
  initials?: string;
  attention: ManagerAttention;
  lastActivity: string;
  seededReadiness?: ManagerReadinessSeed;
};

const CLIENTS: readonly ManagerPortfolioSeed[] = [
  { id: "alexander-lite", attention: "normal", lastActivity: "Сегодня, 10:20" },
  { id: "maria-pro", attention: "attention", lastActivity: "Сегодня, 12:45" },
  { id: "dmitry-individual", attention: "high", lastActivity: "Сегодня, 14:30" },
  { id: "elena-lite", displayName: "Елена Морозова", initials: "ЕМ", attention: "normal", seededReadiness: { practicumProgress: 17, questionnaireProgress: 0, documentReadiness: 0 }, lastActivity: "Вчера, 18:10" },
  { id: "andrey-lite", displayName: "Андрей Крылов", initials: "АК", attention: "attention", seededReadiness: { practicumProgress: 100, questionnaireProgress: 30, documentReadiness: 10 }, lastActivity: "Сегодня, 09:40" },
  { id: "olga-lite", displayName: "Ольга Романова", initials: "ОР", attention: "attention", seededReadiness: { practicumProgress: 100, questionnaireProgress: 72, documentReadiness: 40 }, lastActivity: "Вчера, 16:20" },
  { id: "alexey-pro", displayName: "Алексей Воронов", initials: "АВ", attention: "normal", seededReadiness: { practicumProgress: 100, questionnaireProgress: 90, documentReadiness: 65 }, lastActivity: "Сегодня, 11:15" },
  { id: "natalia-pro", displayName: "Наталья Белова", initials: "НБ", attention: "high", seededReadiness: { practicumProgress: 100, questionnaireProgress: 100, documentReadiness: 90 }, lastActivity: "Сегодня, 13:05" },
];

function getCanonicalReadiness(clientId: string): ManagerReadinessSeed | undefined {
  const practicumProgress = getPracticumProgress(clientId);
  const questionnaireProgress = getQuestionnaireProgress(clientId);
  const documentReadiness = getSeededDocumentReadiness(clientId);
  return practicumProgress === undefined || questionnaireProgress === undefined || documentReadiness === undefined
    ? undefined
    : { practicumProgress, questionnaireProgress, documentReadiness };
}

export const MANAGER_CLIENTS: readonly ManagerClient[] = CLIENTS.map((client) => {
  const clientCase = DEMO_CASES.find((item) => item.clientId === client.id)!;
  const identity = getDemoIdentity(client.id) ?? { id: client.id, displayName: client.displayName!, initials: client.initials!, role: "CLIENT" as const, plan: clientCase.plan, caseNumber: clientCase.caseNumber };
  const canonicalReadiness = getCanonicalReadiness(client.id);
  const readiness = canonicalReadiness ?? client.seededReadiness!;

  return {
    identity,
    clientCase,
    employeeId: clientCase.assignedEmployeeId,
    attention: client.attention,
    ...readiness,
    readinessSource: canonicalReadiness ? "canonical" : "presentation-seed",
    lastActivity: client.lastActivity,
  };
});

export const MANAGER_ACTIVITY: readonly ManagerActivityEvent[] = [
  { id: "activity-1", category: "documents", title: "Дмитрий Волков передал документы на проверку", clientId: "dmitry-individual", employeeId: "anna-lawyer", timestamp: "Сегодня, 14:30", period: "today" },
  { id: "activity-2", category: "clients", title: "Мария Соколова обновила сведения об имуществе", clientId: "maria-pro", employeeId: "anna-lawyer", timestamp: "Сегодня, 12:45", period: "today" },
  { id: "activity-3", category: "tasks", title: "Сергей Власов взял задачу в работу", clientId: "natalia-pro", employeeId: "sergey-lawyer", timestamp: "Сегодня, 12:10", period: "today" },
  { id: "activity-4", category: "documents", title: "Алексей Воронов сформировал предварительный комплект", clientId: "alexey-pro", employeeId: "sergey-lawyer", timestamp: "Сегодня, 11:15", period: "today" },
  { id: "activity-5", category: "clients", title: "Андрей Крылов заполнил раздел анкеты", clientId: "andrey-lite", employeeId: "sergey-lawyer", timestamp: "Сегодня, 09:40", period: "today" },
  { id: "activity-6", category: "employees", title: "Анна Орлова завершила проверку документа", clientId: "dmitry-individual", employeeId: "anna-lawyer", timestamp: "Вчера, 18:25", period: "yesterday" },
  { id: "activity-7", category: "clients", title: "Елена Морозова завершила урок Практикума", clientId: "elena-lite", employeeId: "anna-lawyer", timestamp: "Вчера, 18:10", period: "yesterday" },
  { id: "activity-8", category: "system", title: "Дело Натальи Беловой перешло на этап проверки", clientId: "natalia-pro", employeeId: "sergey-lawyer", timestamp: "Вчера, 16:05", period: "yesterday" },
  { id: "activity-9", category: "tasks", title: "Обновлён срок задачи по делу Ольги Романовой", clientId: "olga-lite", employeeId: "sergey-lawyer", timestamp: "12 августа, 15:20", period: "week" },
  { id: "activity-10", category: "system", title: "Сформирована недельная операционная сводка", timestamp: "11 августа, 09:00", period: "week" },
];

export function getManagerClient(clientId: string) { return MANAGER_CLIENTS.find((client) => client.identity.id === clientId); }
export function getManagerCase(caseNumber: string) { return MANAGER_CLIENTS.find((client) => client.clientCase.caseNumber === caseNumber); }
export function getManagerEmployee(employeeId: string) { return MANAGER_EMPLOYEES.find((employee) => employee.id === employeeId); }
