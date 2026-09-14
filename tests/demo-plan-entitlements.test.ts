import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CLIENT_DASHBOARDS } from "@/lib/platform/demo/dashboard";
import { PLAN_LABEL } from "@/lib/platform/themes";

function dashboard(identityId: string) {
  const value = CLIENT_DASHBOARDS.find((item) => item.identityId === identityId);
  assert.ok(value, `missing demo dashboard for ${identityId}`);
  return value;
}

function moduleState(identityId: string, code: "AI_ASSISTANT" | "MORTGAGE") {
  const value = dashboard(identityId).modules.find((item) => item.code === code);
  assert.ok(value, `missing ${code} module for ${identityId}`);
  return value;
}

const lite = dashboard("alexander-lite");
assert.equal(moduleState("alexander-lite", "AI_ASSISTANT").state, "active");
assert.equal(moduleState("alexander-lite", "MORTGAGE").state, "locked");
assert.match(lite.supportDescription, /Самостоятельный формат/i);
assert.match(lite.supportDescription, /AI-помощник/i);
assert.match(lite.supportDescription, /не входит в тариф/i);
assert.doesNotMatch(lite.activity.map((item) => item.text).join("\n"), /принято в работу|проверил.*юрист/i);

const pro = dashboard("maria-pro");
assert.equal(moduleState("maria-pro", "AI_ASSISTANT").state, "active");
assert.equal(moduleState("maria-pro", "MORTGAGE").state, "active");
assert.doesNotMatch(pro.supportDescription, /не входит в тариф/i);

assert.equal(moduleState("dmitry-individual", "AI_ASSISTANT").state, "active");
assert.equal(moduleState("dmitry-individual", "MORTGAGE").state, "active");

for (const item of CLIENT_DASHBOARDS) {
  const ai = item.modules.find((module) => module.code === "AI_ASSISTANT");
  assert.ok(ai);
  assert.notEqual(ai.state, "locked", `${item.identityId} must include AI assistant access`);
  assert.equal(
    "lockLabel" in ai ? ai.lockLabel : undefined,
    undefined,
    `${item.identityId} AI module must not carry a stale tariff lock label`,
  );
}

assert.deepEqual(PLAN_LABEL, {
  LITE: "Лайт",
  PRO: "Про",
  INDIVIDUAL: "Эксклюзив",
});

const platformShell = await readFile(resolve("components/platform/PlatformShell.tsx"), "utf8");
assert.match(platformShell, /: CLIENT_NAVIGATION;/);
assert.doesNotMatch(platformShell, /identity\.plan !== "INDIVIDUAL"/);
assert.doesNotMatch(platformShell, /item\.label === "AI-помощник"/);

console.log("DEMO_PLAN_ENTITLEMENTS_TEST_PASS");
