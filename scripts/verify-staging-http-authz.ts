import "dotenv/config";

function fail(message: string): never {
  console.error(`STAGING_HTTP_AUTHZ_FAIL: ${message}`);
  process.exit(1);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

const baseUrlValue = required("IB_STAGING_BASE_URL");
const baseUrl = new URL(baseUrlValue);
if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
  fail("IB_STAGING_BASE_URL must use https unless it targets localhost");
}
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

const clientCookie = required("IB_STAGING_CLIENT_COOKIE");
const lawyerCookie = required("IB_STAGING_LAWYER_COOKIE");
const managerCookie = required("IB_STAGING_MANAGER_COOKIE");
const clientCaseNumber = required("IB_STAGING_CLIENT_CASE_NUMBER");
const lawyerCaseNumber = required("IB_STAGING_LAWYER_CASE_NUMBER");

type JsonEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string };
};

type SessionData = { roles: string[] };
type CaseData = { caseNumber: string };

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
  return body.data;
}

function hasCase(cases: CaseData[], caseNumber: string) {
  return cases.some((item) => item.caseNumber === caseNumber);
}

async function verifyCaseScopes() {
  const clientCases = await listCases("CLIENT", clientCookie);
  if (!hasCase(clientCases, clientCaseNumber)) fail("CLIENT cannot see its staging case");
  if (hasCase(clientCases, lawyerCaseNumber) && lawyerCaseNumber !== clientCaseNumber) {
    fail("CLIENT can see the LAWYER-only staging case");
  }

  const lawyerCases = await listCases("LAWYER", lawyerCookie);
  if (!hasCase(lawyerCases, lawyerCaseNumber)) fail("LAWYER cannot see its assigned staging case");
  if (hasCase(lawyerCases, clientCaseNumber) && clientCaseNumber !== lawyerCaseNumber) {
    fail("LAWYER can see an unassigned CLIENT-only staging case");
  }

  const managerCases = await listCases("MANAGER", managerCookie);
  if (!hasCase(managerCases, clientCaseNumber)) fail("MANAGER cannot see CLIENT staging case");
  if (!hasCase(managerCases, lawyerCaseNumber)) fail("MANAGER cannot see LAWYER staging case");

  console.log("CASE_SCOPES: CLIENT/Lawyer/Manager visibility verified through HTTP API");
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
