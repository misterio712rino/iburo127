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
const expectedCaseNumber = required("IB_STAGING_CLIENT_CASE_NUMBER");

async function request(path: string, accept: string) {
  return fetch(new URL(path, target), {
    method: "GET",
    headers: {
      accept,
      cookie: clientCookie,
    },
    redirect: "manual",
  });
}

async function resolveClientCaseId(): Promise<string> {
  const response = await request("/api/platform/cases", "application/json");
  if (response.status !== 200) {
    fail(`case discovery returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as CasesEnvelope;
  if (!body.ok || !Array.isArray(body.data)) {
    fail("case discovery returned an invalid private response");
  }

  const selected = body.data.find((item) => item.caseNumber === expectedCaseNumber);
  if (!selected?.id) {
    fail("CLIENT fixture case is not available to the authenticated CLIENT session");
  }
  return selected.id;
}

const serverErrorMarkers = [
  "Application error: a server-side exception has occurred",
  "Internal Server Error",
  "This page could not be found",
] as const;

async function verifySurface(label: string, path: string): Promise<void> {
  const response = await request(path, "text/html,application/xhtml+xml");
  if (response.status !== 200) {
    const location = response.headers.get("location");
    fail(`${label} returned HTTP ${response.status}${location ? ` -> ${location}` : ""}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    fail(`${label} did not return HTML`);
  }

  const html = await response.text();
  if (html.length < 500) {
    fail(`${label} returned an unexpectedly small HTML document`);
  }
  for (const marker of serverErrorMarkers) {
    if (html.includes(marker)) {
      fail(`${label} rendered a framework/server error marker`);
    }
  }

  console.log(`PORTAL_SURFACE_PASS: ${label} ${path}`);
}

try {
  const caseId = await resolveClientCaseId();
  const base = `/portal/cases/${encodeURIComponent(caseId)}`;
  const surfaces = [
    ["Главная", base],
    ["Практикум", `${base}/practicum`],
    ["Урок Практикума", `${base}/practicum/lesson-1`],
    ["Анкета", `${base}/questionnaire`],
    ["Документы", `${base}/documents`],
    ["Файлы", `${base}/files`],
    ["AI-помощник", `${base}/ai`],
    ["Прогресс", `${base}/progress`],
    ["История сопровождения", `${base}/activity`],
    ["Профиль", `/portal/profile?caseId=${encodeURIComponent(caseId)}`],
    ["Уведомления", `/portal/notifications?caseId=${encodeURIComponent(caseId)}`],
    ["Безопасность", `/portal/security?caseId=${encodeURIComponent(caseId)}`],
  ] as const;

  for (const [label, path] of surfaces) {
    await verifySurface(label, path);
  }

  console.log(PASS);
} catch (error) {
  const message = error instanceof Error ? error.message : "unexpected portal navigation failure";
  console.error(`${FAIL}: ${message}`);
  process.exitCode = 1;
}
