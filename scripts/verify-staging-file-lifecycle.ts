import "dotenv/config";

import {
  requireStagingHttpMutationPreflight,
  STAGING_HTTP_MUTATION_PREFLIGHT_FAIL,
} from "./staging-http-mutation-preflight";

const FAIL = "STAGING_FILE_LIFECYCLE_FAIL";
const PASS = "STAGING_FILE_LIFECYCLE_PASS";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string } };
type CaseData = { id: string; caseNumber: string };
type PreparedUpload = { fileId: string; uploadUrl: string; requiredHeaders: Record<string, string> };
type FileData = {
  id: string;
  clientCaseId: string;
  status: "PENDING_UPLOAD" | "PENDING_SCAN" | "SCANNING" | "READY" | "QUARANTINED" | "SCAN_FAILED";
};
type ActivityData = { id: string; type: string };
type DurableReadiness = {
  commitSha?: string;
  phases?: { fileDeletion?: { mode?: string; ready?: boolean } };
};
type DurableWorkerProof = {
  commitSha?: string;
  mode?: string;
  pass?: boolean;
  targetStatus?: string;
  storageConfirmed?: boolean;
  auditEventRecorded?: boolean;
  valuesPrinted?: boolean;
  worker?: {
    claimed?: number;
    completed?: number;
    retried?: number;
    requiresAttention?: number;
    leaseLost?: number;
    finalizationDeferred?: number;
  };
};

type ApiResult<T> = { status: number; body: Envelope<T> };

function fail(message: string): never {
  throw new Error(message);
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

try {
  requireStagingHttpMutationPreflight(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : STAGING_HTTP_MUTATION_PREFLIGHT_FAIL;
  console.error(`${FAIL}: ${message}`);
  process.exit(1);
}

const baseUrl = new URL(required("IB_STAGING_BASE_URL"));
const clientCookie = required("IB_STAGING_CLIENT_COOKIE");
const otherClientCookie = required("IB_STAGING_OTHER_CLIENT_COOKIE");
const lawyerCookie = required("IB_STAGING_LAWYER_COOKIE");
const managerCookie = required("IB_STAGING_MANAGER_COOKIE");
const mutationCaseNumber = required("IB_STAGING_MUTATION_CASE_NUMBER");
const candidateSha = required("GITHUB_SHA").toLowerCase();
if (!EXACT_GIT_SHA_PATTERN.test(candidateSha)) fail("GITHUB_SHA must be an exact commit SHA");

if (process.env.IB_STAGING_FILES_E2E?.trim() !== "1") {
  console.log("STAGING_FILE_LIFECYCLE_SKIP: IB_STAGING_FILES_E2E is not enabled");
  process.exit(0);
}
if (required("IB_STAGING_PRIVATE_BUCKET_CONFIRM") !== `PRIVATE_STAGING_BUCKET:${baseUrl.host}`) {
  fail(`IB_STAGING_PRIVATE_BUCKET_CONFIRM must equal PRIVATE_STAGING_BUCKET:${baseUrl.host}`);
}

function requirePrivateNoStore(response: Response, label: string) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl.includes("no-store")) fail(`${label} response is missing no-store cache policy`);
}

async function parseJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    fail(`${label} returned non-JSON response (HTTP ${response.status})`);
  }
}

async function api<T>(
  label: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  cookie: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      accept: "application/json",
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  requirePrivateNoStore(response, label);
  return { status: response.status, body: await parseJson<Envelope<T>>(response, label) };
}

async function ok<T>(label: string, method: "GET" | "POST" | "DELETE", path: string, cookie: string, body?: unknown) {
  const result = await api<T>(label, method, path, cookie, body);
  if (result.status !== 200 || !result.body.ok || result.body.data === undefined) {
    fail(`${label} expected 200 success, got ${result.status}/${result.body.error?.code ?? "UNKNOWN"}`);
  }
  return result.body.data;
}

async function error(
  label: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  cookie: string,
  expectedStatus: number,
  expectedCode: string,
  body?: unknown,
) {
  const result = await api<never>(label, method, path, cookie, body);
  if (result.status !== expectedStatus || result.body.ok || result.body.error?.code !== expectedCode) {
    fail(`${label} expected ${expectedStatus}/${expectedCode}, got ${result.status}/${result.body.error?.code ?? "UNKNOWN"}`);
  }
}

async function requireDurableDeletionCutover() {
  const response = await fetch(new URL("/_iburo/staging-external-readiness", baseUrl), {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  requirePrivateNoStore(response, "durable deletion readiness");
  const body = await parseJson<DurableReadiness>(response, "durable deletion readiness");
  if (
    response.status !== 200 ||
    body.commitSha !== candidateSha ||
    body.phases?.fileDeletion?.mode !== "durable"
  ) {
    fail("exact staging Preview is not running durable file deletion mode");
  }
}

async function runDurableDeletionWorker(fileId: string) {
  const response = await fetch(new URL("/_iburo/staging-file-deletion-worker", baseUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-iburo-staging-file-deletion-confirm": `RUN_STAGING_FILE_DELETION:${candidateSha}`,
    },
    body: JSON.stringify({ fileId }),
    redirect: "manual",
  });
  requirePrivateNoStore(response, "durable deletion worker proof");
  const body = await parseJson<DurableWorkerProof>(response, "durable deletion worker proof");
  if (
    response.status !== 200 ||
    body.commitSha !== candidateSha ||
    body.mode !== "durable" ||
    body.pass !== true ||
    body.targetStatus !== "COMPLETED" ||
    body.storageConfirmed !== true ||
    body.auditEventRecorded !== true ||
    body.valuesPrinted !== false ||
    body.worker?.requiresAttention !== 0 ||
    body.worker?.finalizationDeferred !== 0
  ) {
    fail(`durable deletion worker proof failed with HTTP ${response.status}`);
  }
}

async function resolveCaseId() {
  const cases = await ok<CaseData[]>("CLIENT case discovery", "GET", "/api/platform/cases", clientCookie);
  const selected = cases.find((item) => item.caseNumber === mutationCaseNumber);
  if (!selected) fail("CLIENT cannot see the dedicated mutation case");
  return selected.id;
}

try {
  await requireDurableDeletionCutover();

  const clientCaseId = await resolveCaseId();
  const listPath = `/api/platform/cases/${encodeURIComponent(clientCaseId)}/files`;
  const activityPath = `/api/platform/cases/${encodeURIComponent(clientCaseId)}/activity?limit=200`;
  const baselineActivity = await ok<ActivityData[]>("file lifecycle activity baseline", "GET", activityPath, clientCookie);
  const baselineIds = new Set(baselineActivity.map((item) => item.id));

  const bytes = Buffer.from("%PDF-1.4\n% iBuro staging file lifecycle E2E\n", "utf8");
  const prepared = await ok<PreparedUpload>("file prepare upload", "POST", listPath, clientCookie, {
    fileName: "iburo-staging-file-lifecycle.pdf",
    mimeType: "application/pdf",
    sizeBytes: bytes.byteLength,
  });
  if (!prepared.fileId || !prepared.uploadUrl.startsWith("https://")) fail("prepare upload returned invalid signed contract");
  if (prepared.requiredHeaders["Content-Type"] !== "application/pdf") fail("prepare upload returned unexpected Content-Type contract");

  const upload = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: prepared.requiredHeaders,
    body: bytes,
    redirect: "manual",
  });
  if (!upload.ok) fail(`signed upload failed with HTTP ${upload.status}`);

  const filePath = `/api/platform/files/${encodeURIComponent(prepared.fileId)}`;
  const completed = await ok<FileData>("file complete", "POST", `${filePath}/complete`, clientCookie);
  if (completed.status !== "PENDING_SCAN" || completed.clientCaseId !== clientCaseId) {
    fail("completed file must enter PENDING_SCAN in the owning case");
  }

  const clientList = await ok<FileData[]>("CLIENT pending file list", "GET", listPath, clientCookie);
  if (!clientList.some((file) => file.id === prepared.fileId && file.status === "PENDING_SCAN")) {
    fail("owning CLIENT must see its PENDING_SCAN file in the authoritative list");
  }

  const [lawyerList, managerList] = await Promise.all([
    ok<FileData[]>("LAWYER file list", "GET", listPath, lawyerCookie),
    ok<FileData[]>("MANAGER file list", "GET", listPath, managerCookie),
  ]);
  if (lawyerList.some((file) => file.id === prepared.fileId) || managerList.some((file) => file.id === prepared.fileId)) {
    fail("STAFF must not see a PENDING_SCAN file as available case material");
  }

  await error("PENDING_SCAN direct read", "GET", filePath, clientCookie, 404, "NOT_FOUND");
  await error("PENDING_SCAN download", "POST", `${filePath}/download`, clientCookie, 404, "NOT_FOUND", { expiresInSeconds: 60 });
  await error("other CLIENT case file list", "GET", listPath, otherClientCookie, 404, "NOT_FOUND");
  await error("other CLIENT delete", "DELETE", filePath, otherClientCookie, 404, "NOT_FOUND");
  await error("LAWYER delete", "DELETE", filePath, lawyerCookie, 403, "FORBIDDEN");
  await error("MANAGER delete", "DELETE", filePath, managerCookie, 403, "FORBIDDEN");

  const deleted = await ok<{ fileId: string }>("CLIENT owned file delete", "DELETE", filePath, clientCookie);
  if (deleted.fileId !== prepared.fileId) fail("delete response returned a different file id");

  // Durable request is deliberately idempotent: the same owner can repeat the
  // request while the tombstone is pending without creating a second outbox row.
  const duplicateDelete = await ok<{ fileId: string }>("CLIENT duplicate durable delete", "DELETE", filePath, clientCookie);
  if (duplicateDelete.fileId !== prepared.fileId) fail("duplicate delete response returned a different file id");

  const afterDelete = await ok<FileData[]>("CLIENT list after delete", "GET", listPath, clientCookie);
  if (afterDelete.some((file) => file.id === prepared.fileId)) fail("deleted file remained in authoritative list");
  await error("deleted file direct read", "GET", filePath, clientCookie, 404, "NOT_FOUND");

  await runDurableDeletionWorker(prepared.fileId);

  const activity = await ok<ActivityData[]>("file lifecycle activity after durable finalization", "GET", activityPath, clientCookie);
  const newTypes = new Set(activity.filter((item) => !baselineIds.has(item.id)).map((item) => item.type));
  for (const expectedType of ["file.upload.registered", "file.upload.completed", "file.deleted"]) {
    if (!newTypes.has(expectedType)) fail(`missing expected activity event ${expectedType}`);
  }
  if (newTypes.has("file.download.authorized")) fail("pending/deleted file unexpectedly produced an authorized download event");

  console.log("FILES: durable outbox, idempotent owner delete, physical object deletion, audit finalization and isolation verified");
  console.log(PASS);
} catch (error) {
  const message = error instanceof Error ? error.message : "unexpected file lifecycle failure";
  console.error(`${FAIL}: ${message}`);
  process.exitCode = 1;
}
