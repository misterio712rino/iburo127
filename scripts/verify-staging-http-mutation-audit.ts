import "dotenv/config";

function fail(message: string): never {
  console.error(`STAGING_HTTP_MUTATION_AUDIT_FAIL: ${message}`);
  process.exit(1);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

const baseUrl = new URL(required("IB_STAGING_BASE_URL"));
if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
  fail("IB_STAGING_BASE_URL must use https unless it targets localhost");
}
if (baseUrl.username || baseUrl.password) fail("IB_STAGING_BASE_URL must not contain credentials");
if (baseUrl.hostname === "iburo127.ru" || baseUrl.hostname === "www.iburo127.ru") {
  fail("production hostname is explicitly blocked");
}
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

if (required("IB_STAGING_MUTATION_TARGET") !== "staging") {
  fail("IB_STAGING_MUTATION_TARGET must equal staging");
}
if (required("IB_STAGING_MUTATION_CONFIRM") !== `MUTATE:${baseUrl.host}`) {
  fail(`IB_STAGING_MUTATION_CONFIRM must equal MUTATE:${baseUrl.host}`);
}

const clientCookie = required("IB_STAGING_CLIENT_COOKIE");
const mutationCaseNumber = required("IB_STAGING_MUTATION_CASE_NUMBER");

type JsonEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string };
};

type CaseData = {
  id: string;
  caseNumber: string;
};

type ActivityData = {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
};

function requirePrivateNoStore(response: Response, label: string) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl.includes("no-store")) {
    fail(`${label} response is missing no-store cache policy`);
  }
}

async function getJson<T>(label: string, path: string): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), {
    method: "GET",
    headers: { accept: "application/json", cookie: clientCookie },
    redirect: "manual",
  });
  requirePrivateNoStore(response, label);

  const text = await response.text();
  let body: JsonEnvelope<T>;
  try {
    body = JSON.parse(text) as JsonEnvelope<T>;
  } catch {
    fail(`${label} returned non-JSON response (status ${response.status})`);
  }

  if (response.status !== 200 || !body.ok || body.data === undefined) {
    fail(`${label} expected 200 success, got ${response.status}/${body.error?.code ?? "UNKNOWN"}`);
  }
  return body.data;
}

async function resolveMutationCaseId() {
  const cases = await getJson<CaseData[]>("mutation audit case list", "/api/platform/cases");
  const clientCase = cases.find((item) => item.caseNumber === mutationCaseNumber);
  if (!clientCase) fail("CLIENT cannot see the dedicated mutation case");
  return clientCase.id;
}

async function listActivity(clientCaseId: string) {
  return getJson<ActivityData[]>(
    "mutation audit activity list",
    `/api/platform/cases/${encodeURIComponent(clientCaseId)}/activity?limit=200`,
  );
}

const suspiciousMetadataKeys = new Set([
  "answer",
  "answers",
  "value",
  "content",
  "documentContent",
  "body",
  "fileName",
  "objectKey",
  "uploadUrl",
  "downloadUrl",
  "signedUrl",
  "url",
  "cookie",
  "session",
  "password",
  "token",
]);

function assertSafeMetadata(events: readonly ActivityData[]) {
  for (const event of events) {
    if (!event.metadata) continue;
    for (const key of Object.keys(event.metadata)) {
      if (suspiciousMetadataKeys.has(key)) {
        fail(`new activity event ${event.type} contains forbidden metadata key ${key}`);
      }
    }
  }
}

function requireEventType(events: readonly ActivityData[], type: string) {
  if (!events.some((event) => event.type === type)) {
    fail(`expected new activity event ${type}`);
  }
}

const mutationCaseId = await resolveMutationCaseId();
const baseline = await listActivity(mutationCaseId);
const baselineIds = new Set(baseline.map((event) => event.id));

await import("./verify-staging-http-mutations");

const after = await listActivity(mutationCaseId);
const newEvents = after.filter((event) => !baselineIds.has(event.id));
if (newEvents.length === 0) fail("mutation run produced no new case activity events");

assertSafeMetadata(newEvents);
requireEventType(newEvents, "questionnaire.answer.updated");
requireEventType(newEvents, "practicum.lesson.completed");
requireEventType(newEvents, "document.regenerated");
requireEventType(newEvents, "document.sent_for_review");
requireEventType(newEvents, "document.reviewed");
requireEventType(newEvents, "task.status.changed");

if (process.env.IB_STAGING_FILES_E2E?.trim() === "1") {
  requireEventType(newEvents, "file.upload.registered");
  requireEventType(newEvents, "file.download.authorized");
}

console.log("AUDIT: expected cross-workflow events and metadata redaction verified");
console.log("STAGING_HTTP_MUTATION_AUDIT_PASS");
