import "dotenv/config";

function fail(message: string): never {
  console.error(`STAGING_HTTP_MUTATION_FAIL: ${message}`);
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
const lawyerCookie = required("IB_STAGING_LAWYER_COOKIE");
const managerCookie = required("IB_STAGING_MANAGER_COOKIE");
const mutationCaseNumber = required("IB_STAGING_MUTATION_CASE_NUMBER");
const mutationTaskId = required("IB_STAGING_MUTATION_TASK_ID");

const DOCUMENT_CODE = "property-inventory";
const QUESTIONNAIRE_FIELD_ID = "city";
const QUESTIONNAIRE_FIELD_VALUE = "IBURO STAGING E2E";
const PRACTICUM_LESSON_ID = "lesson-1";

type JsonEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string };
};

type ApiResult<T> = {
  status: number;
  body: JsonEnvelope<T>;
};

type CaseData = {
  id: string;
  caseNumber: string;
};

type QuestionnaireData = {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  answers: Record<string, string | number | boolean>;
  version: number;
};

type PracticumData = {
  completedLessonIds: string[];
  version: number;
};

type DocumentData = {
  documentCode: string;
  status: "WAITING_DATA" | "DRAFT" | "READY_FOR_REVIEW" | "SENT_FOR_REVIEW" | "REVIEWED";
  version: number;
};

type TaskData = {
  id: string;
  clientCaseId: string;
  status: "NEW" | "WORKING" | "DONE";
  version: number;
};

type PreparedUploadData = {
  fileId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
};

type StoredFileData = {
  id: string;
  clientCaseId: string;
  status:
    | "PENDING_UPLOAD"
    | "PENDING_SCAN"
    | "SCANNING"
    | "READY"
    | "QUARANTINED"
    | "SCAN_FAILED";
};

type SignedDownloadData = {
  url: string;
  expiresAt: string;
};

type MaintenanceScanData = {
  claimed: number;
  clean: number;
  quarantined: number;
  retried: number;
  failed: number;
  leaseLost: number;
};

function requirePrivateNoStore(response: Response, label: string) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl.includes("no-store")) {
    fail(`${label} response is missing no-store cache policy`);
  }
}

async function apiRequest<T>(
  label: string,
  method: "GET" | "POST" | "PATCH",
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
  const text = await response.text();
  let parsed: JsonEnvelope<T>;
  try {
    parsed = JSON.parse(text) as JsonEnvelope<T>;
  } catch {
    fail(`${label} returned non-JSON response (status ${response.status})`);
  }
  return { status: response.status, body: parsed };
}

async function expectOk<T>(
  label: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  cookie: string,
  body?: unknown,
): Promise<T> {
  const result = await apiRequest<T>(label, method, path, cookie, body);
  if (result.status !== 200 || !result.body.ok || result.body.data === undefined) {
    fail(`${label} expected 200 success, got ${result.status}/${result.body.error?.code ?? "UNKNOWN"}`);
  }
  return result.body.data;
}

async function expectError(
  label: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  cookie: string,
  body: unknown,
  expectedStatus: number,
  expectedCode: string,
) {
  const result = await apiRequest<never>(label, method, path, cookie, body);
  if (result.status !== expectedStatus || result.body.ok || result.body.error?.code !== expectedCode) {
    fail(`${label} expected ${expectedStatus}/${expectedCode}, got ${result.status}/${result.body.error?.code ?? "UNKNOWN"}`);
  }
}

function assertVersion(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) fail(`${label} returned invalid version`);
}

function assertVersionAdvance(previous: number, next: number, label: string) {
  assertVersion(previous, `${label} previous`);
  if (next !== previous + 1) fail(`${label} expected version ${previous + 1}, got ${next}`);
}

function casePath(caseId: string, suffix: string) {
  return `/api/platform/cases/${encodeURIComponent(caseId)}${suffix}`;
}

async function listCases(label: string, cookie: string) {
  return expectOk<CaseData[]>(`${label} cases`, "GET", "/api/platform/cases", cookie);
}

async function resolveMutationCase() {
  const [clientCases, lawyerCases, managerCases] = await Promise.all([
    listCases("CLIENT", clientCookie),
    listCases("LAWYER", lawyerCookie),
    listCases("MANAGER", managerCookie),
  ]);

  const clientCase = clientCases.find((item) => item.caseNumber === mutationCaseNumber);
  const lawyerCase = lawyerCases.find((item) => item.caseNumber === mutationCaseNumber);
  const managerCase = managerCases.find((item) => item.caseNumber === mutationCaseNumber);
  if (!clientCase) fail("CLIENT cannot see the dedicated mutation case");
  if (!lawyerCase) fail("LAWYER cannot see the dedicated mutation case; assign the fixture case to the LAWYER");
  if (!managerCase) fail("MANAGER cannot see the dedicated mutation case");
  if (clientCase.id !== lawyerCase.id || clientCase.id !== managerCase.id) {
    fail("mutation case number resolves to different case ids across actors");
  }
  console.log("FIXTURE: shared CLIENT/LAWYER/MANAGER mutation case verified");
  return clientCase.id;
}

async function questionnaireE2e(clientCaseId: string) {
  const path = casePath(clientCaseId, "/questionnaire");
  const answerPath = casePath(clientCaseId, "/questionnaire/answers");

  const initial = await expectOk<QuestionnaireData>("questionnaire get-or-create", "POST", path, clientCookie);
  assertVersion(initial.version, "questionnaire");
  if (initial.status === "COMPLETED") {
    fail("mutation questionnaire fixture is COMPLETED; use a dedicated mutable staging case");
  }

  await expectOk<QuestionnaireData>("LAWYER questionnaire read", "GET", path, lawyerCookie);
  await expectOk<QuestionnaireData>("MANAGER questionnaire read", "GET", path, managerCookie);

  const updated = await expectOk<QuestionnaireData>(
    "questionnaire answer update",
    "PATCH",
    answerPath,
    clientCookie,
    { fieldId: QUESTIONNAIRE_FIELD_ID, value: QUESTIONNAIRE_FIELD_VALUE, expectedVersion: initial.version },
  );
  assertVersionAdvance(initial.version, updated.version, "questionnaire answer update");
  if (updated.answers[QUESTIONNAIRE_FIELD_ID] !== QUESTIONNAIRE_FIELD_VALUE) {
    fail("questionnaire mutation response does not contain the expected authoritative answer");
  }

  const authoritative = await expectOk<QuestionnaireData>("questionnaire authoritative GET", "GET", path, clientCookie);
  if (authoritative.version !== updated.version || authoritative.answers[QUESTIONNAIRE_FIELD_ID] !== QUESTIONNAIRE_FIELD_VALUE) {
    fail("questionnaire authoritative GET does not match the committed mutation");
  }

  await expectError(
    "questionnaire stale mutation",
    "PATCH",
    answerPath,
    clientCookie,
    { fieldId: QUESTIONNAIRE_FIELD_ID, value: QUESTIONNAIRE_FIELD_VALUE, expectedVersion: initial.version },
    409,
    "VERSION_CONFLICT",
  );
  await expectError(
    "LAWYER questionnaire mutation",
    "PATCH",
    answerPath,
    lawyerCookie,
    { fieldId: QUESTIONNAIRE_FIELD_ID, value: QUESTIONNAIRE_FIELD_VALUE, expectedVersion: updated.version },
    403,
    "FORBIDDEN",
  );
  await expectError(
    "MANAGER questionnaire mutation",
    "PATCH",
    answerPath,
    managerCookie,
    { fieldId: QUESTIONNAIRE_FIELD_ID, value: QUESTIONNAIRE_FIELD_VALUE, expectedVersion: updated.version },
    403,
    "FORBIDDEN",
  );

  let current = updated;
  const documentFields: Array<[string, string | boolean]> = [
    ["fullName", "IBURO STAGING E2E"],
    ["hasRealEstate", false],
    ["hasVehicle", false],
    ["hasValuables", false],
  ];
  for (const [fieldId, value] of documentFields) {
    const next = await expectOk<QuestionnaireData>(
      "questionnaire document fixture preparation",
      "PATCH",
      answerPath,
      clientCookie,
      { fieldId, value, expectedVersion: current.version },
    );
    assertVersionAdvance(current.version, next.version, "questionnaire document fixture preparation");
    current = next;
  }

  console.log("QUESTIONNAIRE: mutation, authoritative read, staff denial and stale-version conflict verified");
}

async function practicumE2e(clientCaseId: string) {
  const path = casePath(clientCaseId, "/practicum");
  const completePath = casePath(clientCaseId, "/practicum/lessons/complete");
  const initial = await expectOk<PracticumData>("practicum get-or-create", "POST", path, clientCookie);
  assertVersion(initial.version, "practicum");

  await expectOk<PracticumData>("LAWYER practicum read", "GET", path, lawyerCookie);
  await expectOk<PracticumData>("MANAGER practicum read", "GET", path, managerCookie);

  const updated = await expectOk<PracticumData>(
    "practicum lesson completion",
    "POST",
    completePath,
    clientCookie,
    { lessonId: PRACTICUM_LESSON_ID, expectedVersion: initial.version },
  );
  assertVersionAdvance(initial.version, updated.version, "practicum lesson completion");
  if (!updated.completedLessonIds.includes(PRACTICUM_LESSON_ID)) {
    fail("practicum mutation response does not contain completed lesson");
  }

  const authoritative = await expectOk<PracticumData>("practicum authoritative GET", "GET", path, clientCookie);
  if (authoritative.version !== updated.version || !authoritative.completedLessonIds.includes(PRACTICUM_LESSON_ID)) {
    fail("practicum authoritative GET does not match the committed mutation");
  }

  await expectError(
    "practicum stale mutation",
    "POST",
    completePath,
    clientCookie,
    { lessonId: PRACTICUM_LESSON_ID, expectedVersion: initial.version },
    409,
    "VERSION_CONFLICT",
  );
  await expectError(
    "LAWYER practicum mutation",
    "POST",
    completePath,
    lawyerCookie,
    { lessonId: PRACTICUM_LESSON_ID, expectedVersion: updated.version },
    403,
    "FORBIDDEN",
  );
  await expectError(
    "MANAGER practicum mutation",
    "POST",
    completePath,
    managerCookie,
    { lessonId: PRACTICUM_LESSON_ID, expectedVersion: updated.version },
    403,
    "FORBIDDEN",
  );

  console.log("PRACTICUM: mutation, authoritative read, staff denial and stale-version conflict verified");
}

async function documentsE2e(clientCaseId: string) {
  const basePath = casePath(clientCaseId, `/documents/${encodeURIComponent(DOCUMENT_CODE)}`);
  const regeneratePath = `${basePath}/regenerate`;
  const sendPath = `${basePath}/send-for-review`;
  const reviewedPath = `${basePath}/reviewed`;

  const existing = await expectOk<DocumentData>("document get-or-create", "POST", basePath, clientCookie);
  assertVersion(existing.version, "document");

  const regenerated = await expectOk<DocumentData>(
    "document regenerate",
    "POST",
    regeneratePath,
    clientCookie,
    { expectedVersion: existing.version },
  );
  assertVersionAdvance(existing.version, regenerated.version, "document regenerate");
  if (regenerated.status !== "READY_FOR_REVIEW") {
    fail("document fixture did not regenerate to READY_FOR_REVIEW");
  }

  await expectError(
    "document stale regenerate",
    "POST",
    regeneratePath,
    clientCookie,
    { expectedVersion: existing.version },
    409,
    "VERSION_CONFLICT",
  );
  await expectError(
    "document invalid review transition",
    "POST",
    reviewedPath,
    lawyerCookie,
    { expectedVersion: regenerated.version },
    409,
    "INVALID_TRANSITION",
  );

  const sent = await expectOk<DocumentData>(
    "document send for review",
    "POST",
    sendPath,
    clientCookie,
    { expectedVersion: regenerated.version },
  );
  assertVersionAdvance(regenerated.version, sent.version, "document send for review");
  if (sent.status !== "SENT_FOR_REVIEW") fail("document did not enter SENT_FOR_REVIEW");

  await expectError(
    "CLIENT document review",
    "POST",
    reviewedPath,
    clientCookie,
    { expectedVersion: sent.version },
    403,
    "FORBIDDEN",
  );

  const lawyerReviewed = await expectOk<DocumentData>(
    "LAWYER document review",
    "POST",
    reviewedPath,
    lawyerCookie,
    { expectedVersion: sent.version },
  );
  assertVersionAdvance(sent.version, lawyerReviewed.version, "LAWYER document review");
  if (lawyerReviewed.status !== "REVIEWED") fail("LAWYER review did not enter REVIEWED");

  const regeneratedForManagerCheck = await expectOk<DocumentData>(
    "document regenerate for manager read-only check",
    "POST",
    regeneratePath,
    clientCookie,
    { expectedVersion: lawyerReviewed.version },
  );
  if (regeneratedForManagerCheck.status !== "READY_FOR_REVIEW") fail("document did not return to READY_FOR_REVIEW");
  const sentForManagerCheck = await expectOk<DocumentData>(
    "document send for manager read-only check",
    "POST",
    sendPath,
    clientCookie,
    { expectedVersion: regeneratedForManagerCheck.version },
  );
  await expectError(
    "MANAGER document review",
    "POST",
    reviewedPath,
    managerCookie,
    { expectedVersion: sentForManagerCheck.version },
    403,
    "FORBIDDEN",
  );
  const lawyerReviewedAfterManagerDenial = await expectOk<DocumentData>(
    "LAWYER document review after manager denial",
    "POST",
    reviewedPath,
    lawyerCookie,
    { expectedVersion: sentForManagerCheck.version },
  );
  if (lawyerReviewedAfterManagerDenial.status !== "REVIEWED") fail("LAWYER review did not enter REVIEWED");

  const [clientRead, lawyerRead, managerRead] = await Promise.all([
    expectOk<DocumentData>("CLIENT document authoritative GET", "GET", basePath, clientCookie),
    expectOk<DocumentData>("LAWYER document authoritative GET", "GET", basePath, lawyerCookie),
    expectOk<DocumentData>("MANAGER document authoritative GET", "GET", basePath, managerCookie),
  ]);
  if (clientRead.version !== lawyerReviewedAfterManagerDenial.version || lawyerRead.version !== lawyerReviewedAfterManagerDenial.version || managerRead.version !== lawyerReviewedAfterManagerDenial.version) {
    fail("document authoritative reads disagree after review");
  }

  console.log("DOCUMENTS: lifecycle, invalid transition, stale version, assigned LAWYER review and CLIENT/MANAGER denial verified");
}

async function tasksE2e(clientCaseId: string) {
  const [lawyerTasks, managerTasks] = await Promise.all([
    expectOk<TaskData[]>("LAWYER tasks", "GET", "/api/platform/tasks", lawyerCookie),
    expectOk<TaskData[]>("MANAGER tasks", "GET", "/api/platform/tasks", managerCookie),
  ]);
  const task = lawyerTasks.find((item) => item.id === mutationTaskId);
  if (!task) fail("LAWYER cannot see IB_STAGING_MUTATION_TASK_ID");
  if (task.clientCaseId !== clientCaseId) fail("mutation task does not belong to the dedicated mutation case");
  if (!managerTasks.some((item) => item.id === mutationTaskId)) fail("MANAGER cannot see the mutation task");
  if (task.status !== "NEW") fail("mutation task must start in NEW; reset the dedicated staging fixture before running");
  assertVersion(task.version, "task");

  const statusPath = `/api/platform/tasks/${encodeURIComponent(task.id)}/status`;
  const taskPath = `/api/platform/tasks/${encodeURIComponent(task.id)}`;
  const createPath = `/api/platform/cases/${encodeURIComponent(clientCaseId)}/tasks`;
  await expectError(
    "MANAGER task create",
    "POST",
    createPath,
    managerCookie,
    { title: "Manager read-only probe", description: null, dueAt: null },
    403,
    "FORBIDDEN",
  );
  const working = await expectOk<TaskData>(
    "LAWYER task NEW to WORKING",
    "PATCH",
    statusPath,
    lawyerCookie,
    { status: "WORKING", expectedVersion: task.version },
  );
  assertVersionAdvance(task.version, working.version, "LAWYER task NEW to WORKING");
  if (working.status !== "WORKING") fail("LAWYER task mutation did not enter WORKING");

  await expectError(
    "task stale mutation",
    "PATCH",
    statusPath,
    lawyerCookie,
    { status: "WORKING", expectedVersion: task.version },
    409,
    "VERSION_CONFLICT",
  );
  await expectError(
    "CLIENT task mutation",
    "PATCH",
    statusPath,
    clientCookie,
    { status: "DONE", expectedVersion: working.version },
    403,
    "FORBIDDEN",
  );

  await expectError(
    "MANAGER task status mutation",
    "PATCH",
    statusPath,
    managerCookie,
    { status: "DONE", expectedVersion: working.version },
    403,
    "FORBIDDEN",
  );

  const done = await expectOk<TaskData>(
    "LAWYER task WORKING to DONE",
    "PATCH",
    statusPath,
    lawyerCookie,
    { status: "DONE", expectedVersion: working.version },
  );
  assertVersionAdvance(working.version, done.version, "LAWYER task WORKING to DONE");
  if (done.status !== "DONE") fail("LAWYER task mutation did not enter DONE");

  const authoritative = await expectOk<TaskData>("LAWYER task authoritative GET", "GET", taskPath, lawyerCookie);
  if (authoritative.status !== "DONE" || authoritative.version !== done.version) {
    fail("task authoritative GET does not match committed status");
  }

  const restored = await expectOk<TaskData>(
    "LAWYER task fixture restore",
    "PATCH",
    statusPath,
    lawyerCookie,
    { status: "NEW", expectedVersion: done.version },
  );
  if (restored.status !== "NEW") fail("mutation task fixture could not be restored to NEW");

  console.log("TASKS: LAWYER mutations, stale conflict, CLIENT/MANAGER denial and fixture restore verified");
}

function readBoundedPositiveInteger(name: string, fallback: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    fail(`${name} must be an integer between 1 and ${max}`);
  }
  return value;
}

async function runFileScanMaintenance(secret: string): Promise<MaintenanceScanData> {
  const response = await fetch(new URL("/api/internal/maintenance/file-scans", baseUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${secret}`,
    },
    redirect: "manual",
  });
  requirePrivateNoStore(response, "file scan maintenance");

  const text = await response.text();
  let body: JsonEnvelope<MaintenanceScanData>;
  try {
    body = JSON.parse(text) as JsonEnvelope<MaintenanceScanData>;
  } catch {
    fail(`file scan maintenance returned non-JSON response (status ${response.status})`);
  }
  if (response.status !== 200 || !body.ok || !body.data) {
    fail(`file scan maintenance expected 200 success, got ${response.status}/${body.error?.code ?? "UNKNOWN"}`);
  }
  return body.data;
}

async function filesE2e(clientCaseId: string) {
  if (process.env.IB_STAGING_FILES_E2E?.trim() !== "1") {
    console.log("FILES_CONTRACT: storage E2E prepared but skipped; set IB_STAGING_FILES_E2E=1 only after private staging bucket setup");
    return;
  }

  if (required("IB_STAGING_PRIVATE_BUCKET_CONFIRM") !== `PRIVATE_STAGING_BUCKET:${baseUrl.host}`) {
    fail(`IB_STAGING_PRIVATE_BUCKET_CONFIRM must equal PRIVATE_STAGING_BUCKET:${baseUrl.host}`);
  }
  const otherClientCookie = required("IB_STAGING_OTHER_CLIENT_COOKIE");
  if (otherClientCookie === clientCookie) fail("IB_STAGING_OTHER_CLIENT_COOKIE must belong to a different CLIENT fixture");

  const bytes = Buffer.from("%PDF-1.4\n% iBuro staging mutation E2E\n", "utf8");
  const listPath = casePath(clientCaseId, "/files");
  const prepared = await expectOk<PreparedUploadData>(
    "file prepare upload",
    "POST",
    listPath,
    clientCookie,
    { fileName: "iburo-staging-e2e.pdf", mimeType: "application/pdf", sizeBytes: bytes.byteLength },
  );
  if (!prepared.fileId || !prepared.uploadUrl.startsWith("https://")) fail("file prepare upload returned invalid signed upload contract");
  if (prepared.requiredHeaders["Content-Type"] !== "application/pdf") fail("file prepare upload returned unexpected required headers");

  const uploadResponse = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: prepared.requiredHeaders,
    body: bytes,
    redirect: "manual",
  });
  if (!uploadResponse.ok) fail(`signed file upload failed with status ${uploadResponse.status}`);

  const filePath = `/api/platform/files/${encodeURIComponent(prepared.fileId)}`;
  const completed = await expectOk<StoredFileData>(
    "file complete verification",
    "POST",
    `${filePath}/complete`,
    clientCookie,
  );
  if (completed.status !== "PENDING_SCAN" || completed.clientCaseId !== clientCaseId) {
    fail("completed file must enter PENDING_SCAN for the mutation case");
  }

  const filesBeforeScan = await expectOk<StoredFileData[]>(
    "file authoritative list before scan",
    "GET",
    listPath,
    clientCookie,
  );
  if (filesBeforeScan.some((file) => file.id === prepared.fileId)) {
    fail("PENDING_SCAN file must not appear in the normal authoritative list");
  }
  await expectError(
    "PENDING_SCAN file get",
    "GET",
    filePath,
    clientCookie,
    undefined,
    404,
    "NOT_FOUND",
  );
  await expectError(
    "PENDING_SCAN file download",
    "POST",
    `${filePath}/download`,
    clientCookie,
    { expiresInSeconds: 60 },
    404,
    "NOT_FOUND",
  );

  await expectError("other CLIENT file get", "GET", filePath, otherClientCookie, undefined, 404, "NOT_FOUND");
  await expectError("other CLIENT file download", "POST", `${filePath}/download`, otherClientCookie, { expiresInSeconds: 60 }, 404, "NOT_FOUND");
  await expectError("other CLIENT case file list", "GET", listPath, otherClientCookie, undefined, 404, "NOT_FOUND");

  console.log("FILES_QUARANTINE_BOUNDARY: upload completion produced PENDING_SCAN and normal read/download paths stayed closed");

  if (process.env.IB_STAGING_FILE_SCAN_E2E?.trim() !== "1") {
    console.log("FILES_SCAN: CLEAN-to-READY E2E skipped; set IB_STAGING_FILE_SCAN_E2E=1 only after scanner smoke verification");
    return;
  }

  if (required("IB_STAGING_FILE_SCAN_E2E_CONFIRM") !== `SCAN:${baseUrl.host}`) {
    fail(`IB_STAGING_FILE_SCAN_E2E_CONFIRM must equal SCAN:${baseUrl.host}`);
  }
  const maintenanceSecret = required("IB_MAINTENANCE_SECRET");
  if (maintenanceSecret.length < 32) fail("IB_MAINTENANCE_SECRET must be at least 32 characters");
  const maxRuns = readBoundedPositiveInteger("IB_STAGING_FILE_SCAN_E2E_MAX_RUNS", 5, 20);

  let ready: StoredFileData | null = null;
  for (let run = 1; run <= maxRuns; run += 1) {
    const result = await runFileScanMaintenance(maintenanceSecret);
    if (result.retried > 0 || result.failed > 0 || result.leaseLost > 0) {
      fail("file scan maintenance reported retry/failure/lease-loss during CLEAN lifecycle verification");
    }

    const read = await apiRequest<StoredFileData>(
      `file readiness check ${run}`,
      "GET",
      filePath,
      clientCookie,
    );
    if (read.status === 200 && read.body.ok && read.body.data?.status === "READY") {
      ready = read.body.data;
      break;
    }
    if (read.status !== 404 || read.body.ok || read.body.error?.code !== "NOT_FOUND") {
      fail(`file readiness check ${run} expected READY or hidden NOT_FOUND`);
    }
  }

  if (!ready || ready.clientCaseId !== clientCaseId) {
    fail(`file did not reach READY after ${maxRuns} bounded scan-worker runs`);
  }

  const filesAfterScan = await expectOk<StoredFileData[]>(
    "file authoritative list after clean scan",
    "GET",
    listPath,
    clientCookie,
  );
  if (!filesAfterScan.some((file) => file.id === prepared.fileId && file.status === "READY")) {
    fail("scanner-confirmed READY file is missing from authoritative list");
  }

  const signedDownload = await expectOk<SignedDownloadData>(
    "file signed download after clean scan",
    "POST",
    `${filePath}/download`,
    clientCookie,
    { expiresInSeconds: 60 },
  );
  if (!signedDownload.url.startsWith("https://")) fail("file download endpoint returned invalid signed URL contract");
  const downloadResponse = await fetch(signedDownload.url, { method: "GET", redirect: "manual" });
  if (!downloadResponse.ok) fail(`signed file download failed with status ${downloadResponse.status}`);
  const downloaded = Buffer.from(await downloadResponse.arrayBuffer());
  if (!downloaded.equals(bytes)) fail("signed file download bytes do not match uploaded fixture");

  console.log("FILES: PENDING_SCAN fail-closed boundary, scanner CLEAN to READY, signed download bytes and cross-client denial verified");
}

const mutationCaseId = await resolveMutationCase();
await questionnaireE2e(mutationCaseId);
await practicumE2e(mutationCaseId);
await documentsE2e(mutationCaseId);
await tasksE2e(mutationCaseId);
await filesE2e(mutationCaseId);

console.log("STAGING_HTTP_MUTATION_PASS");
