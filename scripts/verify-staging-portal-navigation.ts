import "dotenv/config";

import {
  requireStagingHttpTarget,
  STAGING_HTTP_TARGET_GUARD,
} from "./staging-http-target-guard";

const FAIL = "STAGING_PORTAL_NAVIGATION_FAIL";
const PASS = "STAGING_PORTAL_NAVIGATION_PASS";

type CaseTransport = {
  id: string;
  caseNumber: string;
};

type CasesEnvelope = {
  ok: boolean;
  data?: CaseTransport[];
};

type RoleLabel = "CLIENT" | "LAWYER" | "MANAGER";

type SurfaceSpec = readonly [
  label: string,
  path: string,
  requiredMarker?: string,
];

function fail(message: string): never {
  throw new Error(message);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

let target: URL;
try {
  target = requireStagingHttpTarget(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : "unsafe staging HTTP target";
  console.error(`${FAIL}: ${STAGING_HTTP_TARGET_GUARD}: ${message}`);
  process.exit(1);
}

const clientCookie = required("IB_STAGING_CLIENT_COOKIE");
const lawyerCookie = required("IB_STAGING_LAWYER_COOKIE");
const managerCookie = required("IB_STAGING_MANAGER_COOKIE");
const expectedClientCaseNumber = required("IB_STAGING_CLIENT_CASE_NUMBER");
const expectedClientUnassignedCaseNumber = required("IB_STAGING_CLIENT_UNASSIGNED_CASE_NUMBER");
const expectedLawyerCaseNumber = required("IB_STAGING_LAWYER_CASE_NUMBER");

async function request(cookie: string, path: string, accept: string) {
  return fetch(new URL(path, target), {
    method: "GET",
    headers: {
      accept,
      cookie,
    },
    redirect: "manual",
  });
}

async function resolveCaseId(
  role: RoleLabel,
  cookie: string,
  expectedCaseNumber: string,
): Promise<string> {
  const response = await request(cookie, "/api/platform/cases", "application/json");
  if (response.status !== 200) {
    fail(`${role} case discovery returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as CasesEnvelope;
  if (!body.ok || !Array.isArray(body.data)) {
    fail(`${role} case discovery returned an invalid private response`);
  }

  const selected = body.data.find((item) => item.caseNumber === expectedCaseNumber);
  if (!selected?.id) {
    fail(`${role} fixture case ${expectedCaseNumber} is not available to the authenticated session`);
  }
  return selected.id;
}

const serverErrorMarkers = [
  "Application error: a server-side exception has occurred",
  "Internal Server Error",
  "This page could not be found",
] as const;

async function verifySurface(
  role: RoleLabel,
  cookie: string,
  label: string,
  path: string,
  requiredMarker?: string,
): Promise<void> {
  const response = await request(cookie, path, "text/html,application/xhtml+xml");
  if (response.status !== 200) {
    const location = response.headers.get("location");
    fail(
      `${role} ${label} returned HTTP ${response.status}${location ? ` -> ${location}` : ""}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    fail(`${role} ${label} did not return HTML`);
  }

  const html = await response.text();
  if (html.length < 500) {
    fail(`${role} ${label} returned an unexpectedly small HTML document`);
  }
  for (const marker of serverErrorMarkers) {
    if (html.includes(marker)) {
      fail(`${role} ${label} rendered a framework/server error marker`);
    }
  }
  if (requiredMarker && !html.includes(requiredMarker)) {
    fail(`${role} ${label} did not render the expected role marker`);
  }

  console.log(`PORTAL_SURFACE_PASS: ${role} ${label} ${path}`);
}

async function verifyHiddenSurface(
  role: RoleLabel,
  cookie: string,
  label: string,
  path: string,
): Promise<void> {
  const response = await request(cookie, path, "text/html,application/xhtml+xml");
  if (response.status !== 404) {
    const location = response.headers.get("location");
    fail(
      `${role} ${label} expected hidden HTTP 404, got ${response.status}${location ? ` -> ${location}` : ""}`,
    );
  }
  if (response.headers.get("location")) {
    fail(`${role} ${label} must fail closed as NOT_FOUND without redirect`);
  }
  console.log(`PORTAL_HIDDEN_SURFACE_PASS: ${role} ${label} ${path}`);
}

async function verifySurfaces(
  role: RoleLabel,
  cookie: string,
  surfaces: readonly SurfaceSpec[],
): Promise<void> {
  for (const [label, path, marker] of surfaces) {
    await verifySurface(role, cookie, label, path, marker);
  }
  console.log(`STAGING_PORTAL_ROLE_SURFACES_PASS: ${role}`);
}

try {
  const [clientCaseId, clientUnassignedCaseId, lawyerCaseId, managerCaseId] = await Promise.all([
    resolveCaseId("CLIENT", clientCookie, expectedClientCaseNumber),
    resolveCaseId("CLIENT", clientCookie, expectedClientUnassignedCaseNumber),
    resolveCaseId("LAWYER", lawyerCookie, expectedLawyerCaseNumber),
    resolveCaseId("MANAGER", managerCookie, expectedLawyerCaseNumber),
  ]);

  const clientBase = `/portal/cases/${encodeURIComponent(clientCaseId)}`;
  await verifySurfaces("CLIENT", clientCookie, [
    ["Главная", clientBase],
    ["Практикум", `${clientBase}/practicum`],
    ["Урок Практикума", `${clientBase}/practicum/lesson-1`],
    ["Анкета", `${clientBase}/questionnaire`],
    ["Документы", `${clientBase}/documents`],
    ["Файлы", `${clientBase}/files`],
    ["AI-помощник", `${clientBase}/ai`],
    ["Прогресс", `${clientBase}/progress`],
    ["История сопровождения", `${clientBase}/activity`],
    ["Профиль", `/portal/profile?caseId=${encodeURIComponent(clientCaseId)}`],
    ["Уведомления", `/portal/notifications?caseId=${encodeURIComponent(clientCaseId)}`],
    ["Безопасность", `/portal/security?caseId=${encodeURIComponent(clientCaseId)}`],
  ]);

  const lawyerBase = `/portal/cases/${encodeURIComponent(lawyerCaseId)}`;
  await verifySurfaces("LAWYER", lawyerCookie, [
    ["Рабочий стол", "/portal", "Рабочий стол юриста"],
    ["Назначенное дело", lawyerBase],
    ["Практикум", `${lawyerBase}/practicum`, "Учебный прогресс клиента"],
    ["Документы", `${lawyerBase}/documents`],
    ["Файлы", `${lawyerBase}/files`],
    ["Прогресс", `${lawyerBase}/progress`],
    ["История сопровождения", `${lawyerBase}/activity`],
    ["Задачи дела", `${lawyerBase}/tasks`],
    ["Общая очередь задач", "/portal/tasks"],
    ["Профиль", "/portal/profile"],
    ["Уведомления", "/portal/notifications"],
    ["Безопасность", "/portal/security"],
  ]);

  const managerBase = `/portal/cases/${encodeURIComponent(managerCaseId)}`;
  await verifySurfaces("MANAGER", managerCookie, [
    ["Рабочий стол", "/portal", "Панель руководителя"],
    ["Дело под контролем", managerBase],
    ["Практикум", `${managerBase}/practicum`, "Учебный прогресс клиента"],
    ["Документы", `${managerBase}/documents`],
    ["Файлы", `${managerBase}/files`],
    ["Прогресс", `${managerBase}/progress`],
    ["История сопровождения", `${managerBase}/activity`],
    ["Задачи дела", `${managerBase}/tasks`],
    ["Общая очередь задач", "/portal/tasks"],
    ["Потенциальные клиенты", "/portal/leads"],
    ["Профиль", "/portal/profile"],
    ["Уведомления", "/portal/notifications"],
    ["Безопасность", "/portal/security"],
  ]);

  await verifyHiddenSurface(
    "LAWYER",
    lawyerCookie,
    "Неназначенное клиентское дело",
    `/portal/cases/${encodeURIComponent(clientUnassignedCaseId)}`,
  );
  await verifyHiddenSurface(
    "CLIENT",
    clientCookie,
    "Чужое назначенное дело",
    `/portal/cases/${encodeURIComponent(lawyerCaseId)}`,
  );
  console.log("STAGING_PORTAL_DIRECT_CASE_ISOLATION_PASS");

  console.log(PASS);
} catch (error) {
  const message = error instanceof Error ? error.message : "unexpected portal navigation failure";
  console.error(`${FAIL}: ${message}`);
  process.exitCode = 1;
}
