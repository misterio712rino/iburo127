import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

await import("./mobile-critical-portal-contract.test");
await import("./auth-touch-target-contract.test");
await import("./client-case-switcher-contract.test");
await import("./lawyer-interaction-accessibility-contract.test");
await import("./questionnaire-accessibility-contract.test");

const portalSystemStateSource = await readFile(resolve("components/portal/PortalSystemState.tsx"), "utf8");
const portalLoadingSource = await readFile(resolve("app/portal/loading.tsx"), "utf8");
const portalErrorSource = await readFile(resolve("app/portal/error.tsx"), "utf8");
const portalNotFoundSource = await readFile(resolve("app/portal/not-found.tsx"), "utf8");

assert.match(
  portalSystemStateSource,
  /role=\{loading \? "status" : "alert"\}/,
  "portal system states must expose explicit loading/error accessibility roles",
);
assert.match(
  portalSystemStateSource,
  /aria-busy=\{loading \? true : undefined\}/,
  "portal loading state must expose aria-busy",
);
assert.match(
  portalSystemStateSource,
  /animate-spin motion-reduce:animate-none/,
  "portal loading motion must respect reduced-motion preferences",
);
assert.match(
  portalSystemStateSource,
  /min-h-screen/,
  "portal system state must remain a standalone viewport-safe boundary",
);
assert.match(portalLoadingSource, /variant="loading"/);
assert.doesNotMatch(
  portalLoadingSource,
  /createProductionSessionProvider|ClientCaseFrame|ClientPlanVisualStyles|listAccessibleClientCases/,
  "portal loading boundary must not depend on actor, case or plan resolution",
);
assert.match(portalErrorSource, /^"use client";/);
assert.match(portalErrorSource, /onClick=\{reset\}/);
assert.equal(
  (portalErrorSource.match(/min-h-11/g) ?? []).length,
  2,
  "portal error recovery actions must keep 44px minimum touch targets",
);
assert.doesNotMatch(
  portalErrorSource,
  /error\.message|error\.stack|digest|console\.error/,
  "portal error boundary must not expose or log raw runtime error details",
);
assert.match(portalErrorSource, /href="\/portal"/);

assert.match(
  portalNotFoundSource,
  /Раздел не найден или недоступен/,
  "portal not-found copy must deliberately avoid distinguishing missing and unauthorized resources",
);
assert.match(portalNotFoundSource, /href="\/portal"/);
assert.match(
  portalNotFoundSource,
  /inline-flex min-h-11 max-w-full items-center justify-center/,
  "portal not-found recovery action must keep a 44px minimum touch target",
);
assert.doesNotMatch(
  portalNotFoundSource,
  /caseId|clientCase|createProductionSessionProvider|getCurrentPlatformActor|error\.message|digest/,
  "portal not-found boundary must not expose resource identifiers, actor resolution or raw error details",
);

console.log("PORTAL_UI_FOUNDATION_TEST_PASS");
