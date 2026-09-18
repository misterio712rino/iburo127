import assert from "node:assert/strict";

import {
  DOCUMENT_REVISION_INVALID_SOURCE,
  type DocumentSourceValue,
} from "@/server/domain/documents/revision-contracts";
import { assertSha256, hashDocumentSource } from "@/server/domain/documents/revision-source";
import {
  DOCUMENT_TEMPLATE_NOT_REGISTERED,
  EmptyDocumentTemplateRegistry,
} from "@/server/domain/documents/template-contracts";

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
