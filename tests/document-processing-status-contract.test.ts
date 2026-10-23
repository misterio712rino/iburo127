import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const route = await readFile(
  resolve("app/api/platform/cases/[caseId]/document-processing/route.ts"),
  "utf8",
);
const operations = await readFile(resolve("server/files/operations.ts"), "utf8");
const repository = await readFile(
  resolve("server/repositories/prisma/document-processing-job-repository.ts"),
  "utf8",
);
const filesUi = await readFile(resolve("components/platform/files/IBuroFilesV2.tsx"), "utf8");
const documentsUi = await readFile(resolve("components/platform/documents/IBuroDocumentsV2.tsx"), "utf8");
const clientShell = await readFile(resolve("components/portal/IBuroClientShellV2.tsx"), "utf8");
const clientDashboard = await readFile(resolve("components/portal/IBuroClientDashboardV2.tsx"), "utf8");

const accessCheckIndex = operations.indexOf("const files = await listStoredFiles(sessionProvider, clientCaseId)");
const processingReadIndex = operations.indexOf("listSummariesBySourceFileIds(");
assert.ok(accessCheckIndex >= 0 && processingReadIndex > accessCheckIndex,
  "OCR summaries must be queried only for files visible to the authenticated actor");
assert.match(repository, /select:\s*\{\s*sourceFileId: true,\s*status: true,\s*pageCount: true,\s*updatedAt: true,\s*\}/,
  "status API must select only non-content processing metadata");
assert.doesNotMatch(repository, /select:[\s\S]{0,240}pageTexts/,
  "status API must not select stored OCR text");
assert.match(route, /toStoredFileHttpResponse\(result\)/,
  "status API must preserve private, no-store file response headers");
assert.match(filesUi, /cache: "no-store"/,
  "browser status polling must bypass caches");
assert.match(filesUi, /Текст распознан/);
assert.match(filesUi, /не используется для заполнения фактов или подготовки черновиков/,
  "the UI must not claim OCR text already generates legal drafts");
assert.match(filesUi, /const ACCEPT = UPLOAD_ACCEPT_ATTRIBUTE/);
assert.match(filesUi, /accept=\{ACCEPT\}/,
  "the upload UI must use the shared allowlist for all supported formats");
assert.match(documentsUi, /Автозаполнение по распознанным документам ещё не подключено/);
assert.match(documentsUi, /\/files/,
  "the document view must route clients toward uploading source documents");
assert.ok(clientShell.indexOf('label: "Файлы"') < clientShell.indexOf('label: "Анкета"'),
  "file upload must appear before the legacy questionnaire in client navigation");
assert.ok(clientDashboard.indexOf('label="Загрузить документы"') < clientDashboard.indexOf('label="Анкета"'),
  "the client dashboard must put document upload before the legacy questionnaire action");

console.log("DOCUMENT_PROCESSING_STATUS_CONTRACT_PASS");
