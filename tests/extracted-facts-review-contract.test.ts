import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const service = readFileSync(resolve("server/documents/extracted-facts.ts"), "utf8");
const route = readFileSync(resolve("app/api/platform/cases/[caseId]/extracted-facts/route.ts"), "utf8");
const ui = readFileSync(resolve("components/platform/documents/IBuroExtractedFactsV2.tsx"), "utf8");
const documentsUi = readFileSync(resolve("components/platform/documents/IBuroDocumentsV2.tsx"), "utf8");

assert.match(service, /actor\.roles\.includes\("CLIENT"\) \|\| clientCase\.clientId !== actor\.userId/);
assert.match(service, /sourceFile: \{ is: \{ status: "READY" \} \}/);
assert.match(service, /reviewStatus: "NEEDS_REVIEW"/);
assert.match(service, /reviewedById: actor\.userId/);
assert.match(service, /parseExtractedFactCandidate/);
assert.match(service, /parsed\.value\.kind !== oldKind/);
assert.match(route, /readBoundedJsonBody/);
assert.match(route, /export async function PATCH/);
assert.match(ui, /Подтвердить/);
assert.match(ui, /Отклонить/);
assert.match(ui, /Исправить: \{title\}/);
assert.match(ui, /Получить защищённую ссылку/);
assert.match(ui, /не заполняет черновики документов/);
assert.match(documentsUi, /<IBuroExtractedFactsV2 caseId=\{caseId\} \/>/);

console.log("EXTRACTED_FACTS_REVIEW_CONTRACT_PASS");
