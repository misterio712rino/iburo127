import assert from "node:assert/strict";
import { canAccessClientCase } from "@/server/domain/client-cases/access-policy";
import { createQuestionnaireDefinition } from "@/server/domain/questionnaire/definition";
import type { AuthenticatedActor, ClientCaseRecord } from "@/server/domain/client-cases/contracts";
import type { QuestionnaireSection } from "@/lib/platform/types";

const clientCase: ClientCaseRecord = {
  id: "case-1",
  caseNumber: "IBR-2026-000001",
  clientId: "client-1",
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};

const actors: Record<string, AuthenticatedActor> = {
  client: { userId: "client-1", roles: ["CLIENT"] },
  otherClient: { userId: "client-2", roles: ["CLIENT"] },
  lawyer: { userId: "lawyer-1", roles: ["LAWYER"] },
  otherLawyer: { userId: "lawyer-2", roles: ["LAWYER"] },
  manager: { userId: "manager-1", roles: ["MANAGER"] },
  roleless: { userId: "user-1", roles: [] },
};

assert.equal(canAccessClientCase(actors.client, clientCase), true);
assert.equal(canAccessClientCase(actors.otherClient, clientCase), false);
assert.equal(canAccessClientCase(actors.lawyer, clientCase), true);
assert.equal(canAccessClientCase(actors.otherLawyer, clientCase), false);
assert.equal(canAccessClientCase(actors.manager, clientCase), true);
assert.equal(canAccessClientCase(actors.roleless, clientCase), false);

const sections = [
  {
    id: "personal",
    title: "Personal",
    description: "",
    fields: [
      { id: "name", label: "Name", type: "text" },
      { id: "age", label: "Age", type: "number" },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    description: "",
    fields: [{ id: "income", label: "Income", type: "currency" }],
  },
] satisfies QuestionnaireSection[];

const definition = createQuestionnaireDefinition(sections, 1);
assert.equal(definition.schemaVersion, 1);
assert.deepEqual([...definition.sectionIds], ["personal", "finance"]);
assert.deepEqual([...definition.fieldIds], ["name", "age", "income"]);

assert.throws(() => createQuestionnaireDefinition(sections, 0), /QUESTIONNAIRE_INVALID_SCHEMA_VERSION/);

const duplicateFieldSections = [
  sections[0],
  {
    id: "other",
    title: "Other",
    description: "",
    fields: [{ id: "name", label: "Duplicate", type: "text" }],
  },
] satisfies QuestionnaireSection[];

assert.throws(
  () => createQuestionnaireDefinition(duplicateFieldSections, 1),
  /QUESTIONNAIRE_DUPLICATE_FIELD:name/,
);

console.log("production foundation tests: PASS");
