import assert from "node:assert/strict";
import {
  DEMO_PORTAL_MODE_ENABLED,
  isDemoPortalEnabled,
} from "@/server/demo/access";

assert.equal(DEMO_PORTAL_MODE_ENABLED, "enabled");
assert.equal(isDemoPortalEnabled({}), false);
assert.equal(isDemoPortalEnabled({ IB_DEMO_PORTAL_MODE: "disabled" }), false);
assert.equal(isDemoPortalEnabled({ IB_DEMO_PORTAL_MODE: "true" }), false);
assert.equal(isDemoPortalEnabled({ IB_DEMO_PORTAL_MODE: " enabled " }), true);
assert.equal(isDemoPortalEnabled({ IB_DEMO_PORTAL_MODE: "ENABLED" }), false);

await import("./portal-ui-foundation.test.ts");

console.log("DEMO_PORTAL_ACCESS_TEST_PASS");
