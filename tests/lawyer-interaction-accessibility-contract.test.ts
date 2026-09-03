import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve("components/portal/LawyerProductionDashboard.tsx"),
  "utf8",
);

assert.match(
  source,
  /href="\/portal\/tasks"[\s\S]*className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text\[#7b2330\][\s\S]*focus-visible:ring-4 focus-visible:ring-\[#8f1720\]\/10"[\s\S]*>\s*Все задачи/,
  "LAWYER secondary tasks action must be a real 44px inline-flex target with visible keyboard focus",
);
assert.doesNotMatch(
  source,
  /href="\/portal\/tasks" className="text-sm font-bold[^\"]*"[\s\S]*Все задачи/,
  "LAWYER secondary tasks action must not regress to a small inline text link",
);

console.log("LAWYER_INTERACTION_ACCESSIBILITY_CONTRACT_PASS");
