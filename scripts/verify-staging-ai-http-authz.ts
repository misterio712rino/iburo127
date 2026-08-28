import "dotenv/config";

const FAIL = "STAGING_AI_HTTP_AUTHZ_FAIL";

type JsonEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string };
};

type CaseData = {
  id: string;
  caseNumber: string;
};

type AiCaseState = {
  caseId: string;
  enabled: boolean;
};

function fail(message: string): never {
  console.error(`${FAIL}: ${message}`);
  process.exit(1);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function stagingBaseUrl(): URL {
  const url = new URL(required("IB_STAGING_BASE_URL"));
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    fail("IB_STAGING_BASE_URL must use https unless it targets localhost");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

const baseUrl = stagingBaseUrl();
const clientCookie = required("IB_STAGING_CLIENT_COOKIE");
const lawyerCookie = required("IB_STAGING_LAWYER_COOKIE");
const managerCookie = required("IB_STAGING_MANAGER_COOKIE");
const aiCaseNumber = required("IB_STAGING_CLIENT_AI_CASE_NUMBER");
const noAiCaseNumber = required("IB_STAGING_CLIENT_NO_AI_CASE_NUMBER");
const lawyerCaseNumber = required("IB_STAGING_LAWYER_CASE_NUMBER");

if (aiCaseNumber === noAiCaseNumber) {
  fail("AI-enabled and AI-disabled client case numbers must differ");
}

async function request(
  method: "GET" | "POST",
  path: string,
  cookie?: string,
  body?: unknown,
): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method,
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
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

async function listCases(label: string, cookie: string): Promise<CaseData[]> {
  const response = await request("GET", "/api/platform/cases", cookie);
  requirePrivateNoStore(response, `${label} cases`);
  if (response.status !== 200) fail(`${label} cases expected 200, got ${response.status}`);
  const body = await readJson<CaseData[]>(response);
  if (!body.ok || !Array.isArray(body.data)) fail(`${label} cases returned invalid payload`);
  return body.data;
}

function requireCase(cases: CaseData[], caseNumber: string, label: string): CaseData {
  const clientCase = cases.find((item) => item.caseNumber === caseNumber);
  if (!clientCase?.id) fail(`${label} case ${caseNumber} not visible through HTTP API`);
  return clientCase;
}

async function expectError(
  label: string,
  response: Response,
  status: number,
  code: string,
) {
  requirePrivateNoStore(response, label);
  if (response.status !== status) fail(`${label} expected ${status}, got ${response.status}`);
  const body = await readJson<never>(response);
  if (body.ok || body.error?.code !== code) {
    fail(`${label} expected error ${code}`);
  }
}

async function expectAiState(
  label: string,
  clientCase: CaseData,
  expectedEnabled: boolean,
) {
  const response = await request(
    "GET",
    `/api/platform/cases/${encodeURIComponent(clientCase.id)}/ai`,
    clientCookie,
  );
  requirePrivateNoStore(response, label);
  if (response.status !== 200) fail(`${label} expected 200, got ${response.status}`);
  const body = await readJson<AiCaseState>(response);
  if (!body.ok || body.data?.caseId !== clientCase.id) {
    fail(`${label} returned the wrong AI case state`);
  }
  if (body.data.enabled !== expectedEnabled) {
    fail(`${label} enabled expected ${expectedEnabled}, got ${String(body.data.enabled)}`);
  }
}

const clientCases = await listCases("CLIENT", clientCookie);
const managerCases = await listCases("MANAGER", managerCookie);

const aiCase = requireCase(clientCases, aiCaseNumber, "CLIENT AI-enabled");
const noAiCase = requireCase(clientCases, noAiCaseNumber, "CLIENT AI-disabled");
const lawyerCase = requireCase(managerCases, lawyerCaseNumber, "MANAGER-visible lawyer");

await expectError(
  "unauthenticated AI state",
  await request("GET", `/api/platform/cases/${encodeURIComponent(aiCase.id)}/ai`),
  401,
  "UNAUTHENTICATED",
);
console.log("UNAUTHENTICATED: AI endpoint correctly denied");

await expectError(
  "LAWYER AI client endpoint",
  await request(
    "GET",
    `/api/platform/cases/${encodeURIComponent(aiCase.id)}/ai`,
    lawyerCookie,
  ),
  403,
  "FORBIDDEN",
);
console.log("STAFF_BOUNDARY: LAWYER correctly denied from client AI endpoint");

await expectError(
  "MANAGER AI client endpoint",
  await request(
    "GET",
    `/api/platform/cases/${encodeURIComponent(aiCase.id)}/ai`,
    managerCookie,
  ),
  403,
  "FORBIDDEN",
);
console.log("STAFF_BOUNDARY: MANAGER correctly denied from client AI endpoint");

if (lawyerCase.id === aiCase.id || lawyerCase.id === noAiCase.id) {
  fail("LAWYER-only case must differ from both client AI fixture cases");
}

await expectError(
  "CLIENT cross-case AI state",
  await request(
    "GET",
    `/api/platform/cases/${encodeURIComponent(lawyerCase.id)}/ai`,
    clientCookie,
  ),
  404,
  "NOT_FOUND",
);
console.log("OWNERSHIP_BOUNDARY: CLIENT cross-case AI access correctly hidden");

await expectAiState("CLIENT AI-enabled state", aiCase, true);
await expectAiState("CLIENT AI-disabled state", noAiCase, false);
console.log("ENTITLEMENT_STATE: enabled and disabled AI case states verified");

await expectError(
  "CLIENT AI-disabled POST",
  await request(
    "POST",
    `/api/platform/cases/${encodeURIComponent(noAiCase.id)}/ai`,
    clientCookie,
    { message: "Staging entitlement boundary verification." },
  ),
  403,
  "AI_FEATURE_NOT_AVAILABLE",
);
console.log("ENTITLEMENT_BOUNDARY: disabled case rejected before provider call");

console.log("Provider requests intentionally executed by this verifier: 0");
console.log("STAGING_AI_HTTP_AUTHZ_PASS");
