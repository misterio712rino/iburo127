import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const questionnaireSource = await readFile(
  resolve("components/platform/questionnaire/ProductionQuestionnaire.tsx"),
  "utf8",
);
const sectionNavSource = await readFile(
  resolve("components/platform/questionnaire/QuestionnaireSectionNav.tsx"),
  "utf8",
);

assert.match(
  questionnaireSource,
  /const controlId = `questionnaire-field-\$\{field\.id\}`/,
  "questionnaire editable controls must derive a stable DOM id from the field id",
);
assert.match(
  questionnaireSource,
  /<label htmlFor=\{controlId\}/,
  "questionnaire text/select/textarea fields must bind their visible label to the control",
);
assert.equal(
  (questionnaireSource.match(/id=\{controlId\}/g) ?? []).length,
  3,
  "input, select and textarea branches must all expose the bound control id",
);
assert.match(
  questionnaireSource,
  /const hintId = field\.hint \? `\$\{controlId\}-hint` : undefined/,
  "questionnaire hints must have a stable descriptive id",
);
assert.match(
  questionnaireSource,
  /aria-describedby=\{hintId\}/,
  "questionnaire controls must expose their hint through aria-describedby",
);
assert.match(
  questionnaireSource,
  /<fieldset className="min-w-0" aria-describedby=\{hintId\}>/,
  "yes/no choice must be represented as an explicitly grouped field",
);
assert.match(
  questionnaireSource,
  /<legend className="text-sm font-semibold text-foreground">\{fieldLabel\}<\/legend>/,
  "yes/no group must use the visible field label as its accessible legend",
);
assert.match(
  questionnaireSource,
  /aria-pressed=\{value === option\}/,
  "yes/no buttons must expose the current selected state",
);
assert.doesNotMatch(
  questionnaireSource,
  /<label className="text-sm font-semibold text-foreground">/,
  "questionnaire must not regress to a visually labelled but programmatically unbound editable field",
);
assert.doesNotMatch(
  questionnaireSource,
  /<main(?:\s|>)/,
  "questionnaire module must not create a nested main landmark inside the client portal main",
);
assert.match(
  questionnaireSource,
  /<div className="min-w-0">\s*<PlatformCard/,
  "questionnaire content column must remain a neutral layout container",
);

assert.match(
  sectionNavSource,
  /import \{ QUESTIONNAIRE_SECTIONS \} from "@\/lib\/platform\/questionnaire-content";/,
  "production questionnaire navigation must use the authoritative questionnaire content source",
);
assert.doesNotMatch(
  sectionNavSource,
  /@\/lib\/platform\/demo/,
  "production questionnaire navigation must not depend on demo questionnaire data",
);
assert.match(
  sectionNavSource,
  /const sectionCount=QUESTIONNAIRE_SECTIONS\.length;/,
  "questionnaire navigation totals must derive from the authoritative section collection",
);
assert.doesNotMatch(
  sectionNavSource,
  /из 10|из \{10\}/,
  "questionnaire navigation must not hardcode the section count",
);

console.log("QUESTIONNAIRE_ACCESSIBILITY_CONTRACT_PASS");
