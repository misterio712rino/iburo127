export type DemoTaskStatus = "new" | "working" | "done";
export type DemoTaskGroup = "overdue" | "urgent" | "today" | "week";

export type DemoTask = {
  id: string;
  assignedEmployeeId: string;
  clientId: string;
  title: string;
  category: string;
  group: DemoTaskGroup;
  due: string;
  dueOrder: number;
};

export const DEMO_TASKS = [
  { id: "m-overdue", assignedEmployeeId: "anna-lawyer", clientId: "maria-pro", title: "Уточнить сведения об объекте недвижимости", category: "Анкета", group: "overdue", due: "Вчера, 17:00", dueOrder: 1 },
  { id: "d-docs", assignedEmployeeId: "anna-lawyer", clientId: "dmitry-individual", title: "Проверить подготовленные документы", category: "Документы", group: "urgent", due: "Сегодня, 16:00", dueOrder: 2 },
  { id: "m-form", assignedEmployeeId: "anna-lawyer", clientId: "maria-pro", title: "Проверить заполнение анкеты", category: "Анкета", group: "today", due: "Сегодня, 17:30", dueOrder: 3 },
  { id: "d-app", assignedEmployeeId: "anna-lawyer", clientId: "dmitry-individual", title: "Проверить заявление", category: "Документы", group: "today", due: "Сегодня, 18:00", dueOrder: 4 },
  { id: "d-package", assignedEmployeeId: "anna-lawyer", clientId: "dmitry-individual", title: "Подтвердить готовность пакета", category: "Проверка", group: "week", due: "17 августа, 12:00", dueOrder: 5 },
  { id: "m-home", assignedEmployeeId: "anna-lawyer", clientId: "maria-pro", title: "Сверить сведения об ипотеке", category: "Имущество", group: "week", due: "18 августа, 11:00", dueOrder: 6 },
  { id: "a-study", assignedEmployeeId: "anna-lawyer", clientId: "alexander-lite", title: "Проверить прогресс обучения", category: "Практикум", group: "week", due: "20 августа, 10:00", dueOrder: 7 },
  { id: "a-followup", assignedEmployeeId: "anna-lawyer", clientId: "alexander-lite", title: "Подготовить рекомендации по следующему уроку", category: "Сопровождение", group: "week", due: "21 августа, 15:00", dueOrder: 8 },
  { id: "e-study", assignedEmployeeId: "anna-lawyer", clientId: "elena-lite", title: "Связаться по прогрессу Практикума", category: "Сопровождение", group: "week", due: "21 августа, 11:00", dueOrder: 9 },
  { id: "n-review", assignedEmployeeId: "sergey-lawyer", clientId: "natalia-pro", title: "Завершить проверку комплекта документов", category: "Документы", group: "overdue", due: "Вчера, 15:30", dueOrder: 1 },
  { id: "o-data", assignedEmployeeId: "sergey-lawyer", clientId: "olga-lite", title: "Запросить недостающие сведения", category: "Анкета", group: "urgent", due: "Сегодня, 15:00", dueOrder: 2 },
  { id: "a-income", assignedEmployeeId: "sergey-lawyer", clientId: "andrey-lite", title: "Проверить сведения о доходах", category: "Анкета", group: "today", due: "Сегодня, 17:00", dueOrder: 3 },
  { id: "v-docs", assignedEmployeeId: "sergey-lawyer", clientId: "alexey-pro", title: "Проверить предварительный комплект", category: "Документы", group: "week", due: "19 августа, 12:00", dueOrder: 7 },
] as const satisfies readonly DemoTask[];

export function getTasksForEmployee(employeeId: string) {
  return DEMO_TASKS.filter((task) => task.assignedEmployeeId === employeeId);
}
