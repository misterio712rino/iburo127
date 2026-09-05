import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalSource = await readFile(resolve("app/portal/page.tsx"), "utf8");
const stylesSource = await readFile(
  resolve("components/portal/ManagerInteractionStyles.tsx"),
  "utf8",
);

assert.match(
  portalSource,
  /import \{ ManagerInteractionStyles \} from "@\/components\/portal\/ManagerInteractionStyles";/,
  "MANAGER portal route must load the scoped interaction accessibility layer",
);
assert.match(
  portalSource,
  /if \(actor\.roles\.includes\("MANAGER"\)\) \{[\s\S]*manager-interaction-shell[\s\S]*<ManagerInteractionStyles \/>/,
  "MANAGER accessibility layer must stay scoped to the MANAGER route branch",
);
assert.match(
  stylesSource,
  /\.manager-interaction-shell :is\(a, button\) \{[\s\S]*min-height: 44px;/,
  "MANAGER links and buttons must keep a 44px minimum interactive target",
);
assert.match(
  stylesSource,
  /\.manager-interaction-shell :is\(a, button\):focus-visible \{[\s\S]*outline: 3px solid #8f1720;[\s\S]*outline-offset: 3px;/,
  "MANAGER custom controls must expose an explicit visible keyboard focus ring",
);
assert.match(
  stylesSource,
  /\.manager-interaction-shell aside :is\(a, button\):focus-visible \{[\s\S]*outline-color: #ffffff;/,
  "MANAGER dark sidebar controls must keep a high-contrast keyboard focus ring",
);
assert.doesNotMatch(
  stylesSource,
  /outline:\s*none|outline-none/,
  "MANAGER interaction layer must not suppress keyboard focus outlines",
);

console.log("MANAGER_INTERACTION_ACCESSIBILITY_CONTRACT_PASS");
