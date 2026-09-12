import "dotenv/config";

import {
  requireStagingHttpTarget,
  STAGING_HTTP_TARGET_GUARD,
} from "./staging-http-target-guard";

const FAIL = "STAGING_AI_HTTP_AUTHZ_FAIL";
const SAFE_DIAGNOSTIC = /^[A-Z0-9_]+$/;

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

type AiReply = {
  content: string;
  restrictedAction: boolean;
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
const primaryAiCaseNumber = required("IB_STAGING_CLIENT_AI_CASE_NUMBER");
const secondaryAiCaseNumber = required("IB_STAGING_CLIENT_SECOND_AI_CASE_NUMBER");
const lawyerCaseNumber = required("IB_STAGING_LAWYER_CASE_NUMBER");

if (primaryAiCaseNumber === secondaryAiCaseNumber) {
  fail("primary and secondary client AI case numbers must differ");
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
      origin: baseUrl.origin,
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
  if (body.data.enabled !== true) {
    fail(`${label} must expose AI as enabled`);
  }
}

async function expectLiveAiReply(clientCase: CaseData): Promise<void> {
  const response = await request(
    "POST",
    `/api/platform/cases/${encodeURIComponent(clientCase.id)}/ai`,
    clientCookie,
    {
      message: "Какой следующий шаг по текущему этапу?",
      history: [],
    },
  );
  requirePrivateNoStore(response, "CLIENT live AI reply");

  if (response.status !== 200) {
    const body = await readJson<never>(response);
    const rawDiagnostic = response.headers.get("x-iburo-ai-diagnostic") ?? "MISSING";
    const diagnostic = SAFE_DIAGNOSTIC.test(rawDiagnostic) ? rawDiagnostic : "INVALID";
    const rawCode = body.error?.code ?? "UNKNOWN";
    const code = SAFE_DIAGNOSTIC.test(rawCode) ? rawCode : "INVALID";
    fail(
      `CLIENT live AI reply expected 200, got ${response.status} code=${code} diagnostic=${diagnostic}`,
    );
  }

  const body = await readJson<AiReply>(response);
  if (
    !body.ok ||
    typeof body.data?.content !== "string" ||
    !body.data.content.trim() ||
    typeof body.data.restrictedAction !== "boolean"
  ) {
    fail("CLIENT live AI reply returned invalid safe response contract");
  }
  console.log("PROVIDER_REQUEST: full CLIENT AI route returned a valid reply");
}

const clientCases = await listCases("CLIENT", clientCookie);
const managerCases = await listCases("MANAGER", managerCookie);

const primaryAiCase = requireCase(clientCases, primaryAiCaseNumber, "CLIENT primary AI");
const secondaryAiCase = requireCase(clientCases, secondaryAiCaseNumber, "CLIENT secondary AI");
const lawyerCase = requireCase(managerCases, lawyerCaseNumber, "MANAGER-visible lawyer");

await expectError(
  "unauthenticated AI state",
  await request("GET", `/api/platform/cases/${encodeURIComponent(primaryAiCase.id)}/ai`),
  401,
  "UNAUTHENTICATED",
);
console.log("UNAUTHENTICATED: AI endpoint correctly denied");

await expectError(
  "LAWYER AI client endpoint",
  await request(
    "GET",
    `/api/platform/cases/${encodeURIComponent(primaryAiCase.id)}/ai`,
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
    `/api/platform/cases/${encodeURIComponent(primaryAiCase.id)}/ai`,
    managerCookie,
  ),
  403,
  "FORBIDDEN",
);
console.log("STAFF_BOUNDARY: MANAGER correctly denied from client AI endpoint");

if (lawyerCase.id === primaryAiCase.id || lawyerCase.id === secondaryAiCase.id) {
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

await expectAiState("CLIENT primary AI state", primaryAiCase);
await expectAiState("CLIENT secondary AI state", secondaryAiCase);
console.log("ENTITLEMENT_STATE: AI is enabled for both INDIVIDUAL and LITE client fixture cases");

await expectLiveAiReply(primaryAiCase);
console.log("STAGING_AI_HTTP_AUTHZ_PASS");
