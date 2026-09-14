import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const planStylesSource = await readFile(resolve("components/portal/ClientPlanVisualStyles.tsx"), "utf8");
const switcherStylesSource = await readFile(resolve("components/portal/ClientCaseSwitcherStyles.tsx"), "utf8");

assert.equal(
  (planStylesSource.match(/<ClientCaseSwitcherStyles \/>/g) ?? []).length,
  3,
  "every CLIENT plan must load the shared case-switcher continuity layer",
);
assert.match(
  switcherStylesSource,
  /details\[class~="group"\]\[class~="bg-white\/60"\]/,
  "case-switcher compatibility must stay scoped to the reviewed switcher details",
);
assert.doesNotMatch(
  switcherStylesSource,
  /client-user-menu/,
  "case-switcher styles must not alter the separate CLIENT user menu",
);
assert.match(
  switcherStylesSource,
  /min-height:44px/,
  "case-switcher controls must keep a 44px minimum touch target",
);
assert.match(
  switcherStylesSource,
  /var\(--ib-card\)/,
  "case-switcher surfaces must inherit the active plan card color",
);
assert.match(switcherStylesSource, /var\(--ib-text\)/);
assert.match(switcherStylesSource, /var\(--ib-muted\)/);
assert.match(switcherStylesSource, /var\(--ib-accent\)/);
assert.match(
  switcherStylesSource,
  /header > div:last-child > div\[class~="text-xs"\]\[class~="justify-between"\]/,
  "single-case mobile switcher must inherit the active plan text palette",
);

console.log("CLIENT_CASE_SWITCHER_CONTRACT_PASS");
