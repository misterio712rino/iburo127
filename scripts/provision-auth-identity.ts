import "dotenv/config";

import { provisionAuthIdentity } from "@/server/auth/provisioning";

function fail(message: string): never {
  console.error(`AUTH_IDENTITY_PROVISIONING_FAIL: ${message}`);
  process.exit(1);
}

const userId = process.env.IB_AUTH_LINK_USER_ID?.trim();
const subject = process.env.IB_AUTH_LINK_SUBJECT?.trim();
const provider = process.env.IB_AUTH_LINK_PROVIDER?.trim() || "better-auth";
const confirmation = process.env.IB_AUTH_LINK_CONFIRM?.trim();

if (!process.env.DATABASE_URL?.trim()) fail("missing DATABASE_URL");
if (!userId) fail("missing IB_AUTH_LINK_USER_ID");
if (!subject) fail("missing IB_AUTH_LINK_SUBJECT");
if (confirmation !== `LINK:${userId}`) {
  fail("IB_AUTH_LINK_CONFIRM must equal LINK:<IB_AUTH_LINK_USER_ID>");
}

const result = await provisionAuthIdentity({ userId, provider, subject });
console.log(`AUTH_IDENTITY_PROVISIONING_PASS: ${result.provider}/${result.subject} -> ${result.userId}`);
