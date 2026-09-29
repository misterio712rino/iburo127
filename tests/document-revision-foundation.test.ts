import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DOCUMENT_REVISION_INVALID_SOURCE,
  type DocumentSourceValue,
} from "@/server/domain/documents/revision-contracts";
import { assertSha256, hashDocumentSource } from "@/server/domain/documents/revision-source";
import {
  DOCUMENT_TEMPLATE_NOT_REGISTERED,
  EmptyDocumentTemplateRegistry,
} from "@/server/domain/documents/template-contracts";

const prismaDomainSchema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const prismaRevisionSchema = readFileSync(resolve(process.cwd(), "prisma/document-revisions.prisma"), "utf8");
const revisionMigration = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260917_case_document_revisions/migration.sql"),
  "utf8",
);

const revisionRelations = [
  {
    prisma: /caseDocument\s+CaseDocument\s+@relation\(fields: \[caseDocumentId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
    inverse: /revisions\s+CaseDocumentRevision\[\]/,
    migration: /CaseDocumentRevision_caseDocumentId_fkey[^;]*ON DELETE CASCADE ON UPDATE CASCADE/,
  },
  {
    prisma: /createdBy\s+User\s+@relation\("CaseDocumentRevisionCreator", fields: \[createdByUserId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
    inverse: /documentRevisionsCreated\s+CaseDocumentRevision\[\]\s+@relation\("CaseDocumentRevisionCreator"\)/,
    migration: /CaseDocumentRevision_createdByUserId_fkey[^;]*ON DELETE RESTRICT ON UPDATE CASCADE/,
  },
  {
    prisma: /submittedBy\s+User\?\s+@relation\("CaseDocumentRevisionSubmitter", fields: \[submittedByUserId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
    inverse: /documentRevisionsSubmitted\s+CaseDocumentRevision\[\]\s+@relation\("CaseDocumentRevisionSubmitter"\)/,
    migration: /CaseDocumentRevision_submittedByUserId_fkey[^;]*ON DELETE SET NULL ON UPDATE CASCADE/,
  },
  {
    prisma: /reviewedBy\s+User\?\s+@relation\("CaseDocumentRevisionReviewer", fields: \[reviewedByUserId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
    inverse: /documentRevisionsReviewed\s+CaseDocumentRevision\[\]\s+@relation\("CaseDocumentRevisionReviewer"\)/,
    migration: /CaseDocumentRevision_reviewedByUserId_fkey[^;]*ON DELETE SET NULL ON UPDATE CASCADE/,
  },
];

for (const relation of revisionRelations) {
  assert.match(prismaRevisionSchema, relation.prisma);
  assert.match(prismaDomainSchema, relation.inverse);
  assert.match(revisionMigration, relation.migration);
}

const left: DocumentSourceValue = {
  applicant: {
    fullName: "Test Applicant",
    birthDate: "1990-01-01",
  },
  entries: [
    { name: "Entry A", amount: 100000 },
    { name: "Entry B", amount: 250000, overdue: true },
  ],
  note: null,
};

const sameDifferentOrder: DocumentSourceValue = {
  note: null,
  entries: [
    { amount: 100000, name: "Entry A" },
    { overdue: true, amount: 250000, name: "Entry B" },
  ],
  applicant: {
    birthDate: "1990-01-01",
    fullName: "Test Applicant",
  },
};

const changed: DocumentSourceValue = {
  ...left,
  entries: [{ name: "Entry A", amount: 100001 }],
};

const leftHash = hashDocumentSource(left);
assert.match(leftHash, /^[a-f0-9]{64}$/);
assert.equal(hashDocumentSource(sameDifferentOrder), leftHash);
assert.notEqual(hashDocumentSource(changed), leftHash);
assert.equal(assertSha256(leftHash), leftHash);
assert.throws(() => assertSha256("not-a-sha"), new RegExp(DOCUMENT_REVISION_INVALID_SOURCE));
assert.throws(
  () => hashDocumentSource({ invalid: Number.NaN }),
  new RegExp(DOCUMENT_REVISION_INVALID_SOURCE),
);

const emptyRegistry = new EmptyDocumentTemplateRegistry();
assert.equal(await emptyRegistry.getActive("bankruptcy-application"), null);
assert.equal(DOCUMENT_TEMPLATE_NOT_REGISTERED, "DOCUMENT_TEMPLATE_NOT_REGISTERED");

await import("./document-revision-service.test");
console.log("DOCUMENT_REVISION_FOUNDATION_PASS");
