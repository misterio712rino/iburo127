import "dotenv/config";

import {
  requireStagingHttpTarget,
  STAGING_HTTP_TARGET_GUARD,
} from "./staging-http-target-guard";

const INTERNAL_CASE_NUMBER = /^IBR?-/iu;

function fail(message: string): never {
  console.error(`STAGING_HTTP_AUTHZ_FAIL: ${message}`);
  process.exit(1);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

let baseUrl: URL;
try {
  baseUrl = requireStagingHttpTarget(process.env);
} catch (error) {
  const message =
    error instanceof Error && error.message.startsWith(`${STAGING_HTTP_TARGET_GUARD}:`)
      ? error.message
      : `${STAGING_HTTP_TARGET_GUARD}:UNEXPECTED`;
  fail(message);
}

const clientCookie = required("IB_STAGING_CLIENT_COOKIE");
const lawyerCookie = required("IB_STAGING_LAWYER_COOKIE");
const managerCookie = required("IB_STAGING_MANAGER_COOKIE");

type JsonEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string };
};

type SessionData = { roles: string[] };
type CaseData = { id: string; caseNumber: string };

async function request(path: string, cookie?: string) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
  });
  return response;
}

async function readJson<T>(response: Response): Promise<JsonEnvelope<T>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as JsonEnvelope<T>;
  } catch {
    fail(`non-JSON response from ${response.url} (status ${response.status})`);
  }
}

function requirePrivateNoStore(response: Response, label: string) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl.includes("no-store")) {
    fail(`${label} response is missing no-store cache policy`);
  }
}

async function verifyUnauthenticated() {
  const response = await request("/api/platform/session");
  requirePrivateNoStore(response, "unauthenticated session");
  if (response.status !== 401) fail(`unauthenticated session expected 401, got ${response.status}`);
  const body = await readJson<never>(response);
  if (body.ok || body.error?.code !== "UNAUTHENTICATED") {
    fail("unauthenticated session did not return UNAUTHENTICATED");
  }
  console.log("UNAUTHENTICATED: session endpoint correctly denied");
}

async function verifyRole(label: string, cookie: string, expectedRole: string) {
  const response = await request("/api/platform/session", cookie);
  requirePrivateNoStore(response, `${label} session`);
  if (response.status !== 200) fail(`${label} session expected 200, got ${response.status}`);
  const body = await readJson<SessionData>(response);
  if (!body.ok || !body.data?.roles?.includes(expectedRole)) {
    fail(`${label} session does not contain expected role ${expectedRole}`);
  }
  console.log(`${label}: authenticated session and role verified`);
}

async function listCases(label: string, cookie: string): Promise<CaseData[]> {
  const response = await request("/api/platform/cases", cookie);
  requirePrivateNoStore(response, `${label} cases`);
  if (response.status !== 200) fail(`${label} cases expected 200, got ${response.status}`);
  const body = await readJson<CaseData[]>(response);
  if (!body.ok || !Array.isArray(body.data)) fail(`${label} cases returned invalid payload`);

  const seenIds = new Set<string>();
  for (const [index, item] of body.data.entries()) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      fail(`${label} cases item ${index} is missing an opaque id`);
    }
    if (seenIds.has(item.id)) fail(`${label} cases returned duplicate opaque id`);
    seenIds.add(item.id);

    if (typeof item.caseNumber !== "string") {
      fail(`${label} cases item ${index} returned a non-string caseNumber`);
    }
    if (INTERNAL_CASE_NUMBER.test(item.caseNumber.trim())) {
      fail(`${label} cases exposed an internal case number through authenticated transport`);
    }
  }

  return body.data;
}

function toCaseIds(cases: CaseData[]): Set<string> {
  return new Set(cases.map((item) => item.id));
}

async function verifyCaseScopes() {
  const clientCases = await listCases("CLIENT", clientCookie);
  const lawyerCases = await listCases("LAWYER", lawyerCookie);
  const managerCases = await listCases("MANAGER", managerCookie);

  if (clientCases.length !== 2) {
    fail(`CLIENT technical fixture expected exactly 2 visible cases, got ${clientCases.length}`);
  }

  const clientIds = toCaseIds(clientCases);
  const lawyerIds = toCaseIds(lawyerCases);
  const managerIds = toCaseIds(managerCases);

  const clientCasesVisibleToLawyer = clientCases.filter((item) => lawyerIds.has(item.id));
  if (clientCasesVisibleToLawyer.length !== 1) {
    fail(
      `LAWYER expected exactly 1 assigned technical CLIENT case, got ${clientCasesVisibleToLawyer.length}`,
    );
  }

  const clientOnlyCases = clientCases.filter((item) => !lawyerIds.has(item.id));
  if (clientOnlyCases.length !== 1) {
    fail(`CLIENT expected exactly 1 unassigned CLIENT-only case, got ${clientOnlyCases.length}`);
  }

  const lawyerOnlyCases = lawyerCases.filter((item) => !clientIds.has(item.id));
  if (lawyerOnlyCases.length < 1) {
    fail("LAWYER expected at least 1 assigned case outside the technical CLIENT scope");
  }

  for (const item of clientCases) {
    if (!managerIds.has(item.id)) fail("MANAGER cannot see a CLIENT-visible staging case");
  }
  for (const item of lawyerCases) {
    if (!managerIds.has(item.id)) fail("MANAGER cannot see a LAWYER-visible staging case");
  }

  console.log(
    "CASE_SCOPES: CLIENT/LAWYER/MANAGER visibility verified through opaque case ids; internal case numbers are absent from transport",
  );
}

async function verifyClientCannotUseStaffTasks() {
  const response = await request("/api/platform/tasks", clientCookie);
  requirePrivateNoStore(response, "CLIENT tasks");
  if (response.status !== 403) {
    fail(`CLIENT task list expected 403, got ${response.status}`);
  }
  console.log("STAFF_BOUNDARY: CLIENT task access correctly denied");
}

await verifyUnauthenticated();
await verifyRole("CLIENT", clientCookie, "CLIENT");
await verifyRole("LAWYER", lawyerCookie, "LAWYER");
await verifyRole("MANAGER", managerCookie, "MANAGER");
await verifyCaseScopes();
await verifyClientCannotUseStaffTasks();

console.log("STAGING_HTTP_AUTHZ_PASS");
