import "dotenv/config";

import { provisionAuthIdentity } from "@/server/auth/provisioning";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`AUTH_IDENTITY_PROVISIONING_FAIL: ${message}`);
  process.exit(1);
}

try {
  requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

const userId = process.env.IB_AUTH_LINK_USER_ID?.trim();
const subject = process.env.IB_AUTH_LINK_SUBJECT?.trim();
const provider = process.env.IB_AUTH_LINK_PROVIDER?.trim() || "better-auth";
const confirmation = process.env.IB_AUTH_LINK_CONFIRM?.trim();

if (!userId) fail("missing IB_AUTH_LINK_USER_ID");
if (!subject) fail("missing IB_AUTH_LINK_SUBJECT");
if (confirmation !== `LINK:${userId}`) {
  fail("IB_AUTH_LINK_CONFIRM must equal LINK:<IB_AUTH_LINK_USER_ID>");
}

await provisionAuthIdentity({ userId, provider, subject });
console.log("AUTH_IDENTITY_PROVISIONING_PASS");
