import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const questionnaireSource = await readFile(
  resolve("components/platform/questionnaire/ProductionQuestionnaire.tsx"),
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

console.log("QUESTIONNAIRE_ACCESSIBILITY_CONTRACT_PASS");
