import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientFrameSource = await readFile(resolve("components/portal/ClientCaseFrame.tsx"), "utf8");
const clientAccountStylesSource = await readFile(resolve("components/portal/ClientAccountVisualStyles.tsx"), "utf8");
const mortgageCapabilitySource = await readFile(resolve("components/platform/questionnaire/MortgageCapability.tsx"), "utf8");
const platformPrimitivesSource = await readFile(resolve("components/platform/PlatformPrimitives.tsx"), "utf8");

assert.match(
  clientFrameSource,
  /<summary className="client-user-chip" aria-label="Меню профиля">/,
  "client profile menu must remain an explicitly labelled summary control",
);
assert.match(
  clientAccountStylesSource,
  /\.client-case-shell \.client-user-chip:focus-visible \{[\s\S]*?outline:2px solid var\(--ib-accent\);[\s\S]*?outline-offset:3px;/,
  "client profile menu must expose a visible plan-aware keyboard focus indicator",
);
assert.doesNotMatch(
  clientAccountStylesSource,
  /\.client-user-chip:focus-visible[\s\S]*?outline:\s*none/,
  "client profile focus styling must not suppress the visible outline",
);
assert.match(
  mortgageCapabilitySource,
  /<Icon className="size-5" aria-hidden="true" \/>/,
  "mortgage capability decorative icon must be hidden from assistive technology",
);
assert.match(
  platformPrimitivesSource,
  /export function ProgressBar\(\{ value, label = "Прогресс" \}: \{ value: number; label\?: string \}\)/,
  "shared progress bars must expose a stable accessible name while allowing a contextual label",
);
assert.match(
  platformPrimitivesSource,
  /role="progressbar" aria-label=\{label\} aria-valuemin=\{0\} aria-valuemax=\{100\} aria-valuenow=\{value\}/,
  "progress bars must retain numeric semantics and bind their accessible name",
);

console.log("CLIENT_INTERACTION_ACCESSIBILITY_CONTRACT_PASS");