import "dotenv/config";

import { provisionAuthIdentity } from "@/server/auth/provisioning";
import { requireReviewedStagingMutationPreflight } from "./staging-mutation-preflight";

function fail(message: string): never {
  console.error(`AUTH_IDENTITY_PROVISIONING_FAIL: ${message}`);
  process.exit(1);
}

const userId = process.env.IB_AUTH_LINK_USER_ID?.trim();
const subject = process.env.IB_AUTH_LINK_SUBJECT?.trim();
const provider = process.env.IB_AUTH_LINK_PROVIDER?.trim() || "better-auth";

if (!userId) fail("missing IB_AUTH_LINK_USER_ID");
if (!subject) fail("missing IB_AUTH_LINK_SUBJECT");

try {
  await requireReviewedStagingMutationPreflight({
    env: process.env,
    confirmation: {
      variableName: "IB_AUTH_LINK_CONFIRM",
      expectedValue: (target) => `LINK:${target.expectedDatabaseName}:${userId}`,
    },
  });
} catch (error) {
  fail(error instanceof Error ? error.message : "staging mutation preflight failed");
}

await provisionAuthIdentity({ userId, provider, subject });
console.log("AUTH_IDENTITY_PROVISIONING_PASS");
