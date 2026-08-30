import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve("scripts/verify-staging-better-auth-schema.ts"),
  "utf8",
);

const requiredPhysicalColumns: Record<string, readonly string[]> = {
  user: [
    "id",
    "name",
    "email",
    "emailVerified",
    "image",
    "createdAt",
    "updatedAt",
    "twoFactorEnabled",
  ],
  session: [
    "id",
    "userId",
    "token",
    "expiresAt",
    "ipAddress",
    "userAgent",
    "createdAt",
    "updatedAt",
  ],
  account: [
    "id",
    "userId",
    "issuer",
    "accountId",
    "providerId",
    "accessToken",
    "refreshToken",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
    "scope",
    "idToken",
    "password",
    "createdAt",
    "updatedAt",
  ],
  verification: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
  twoFactor: [
    "id",
    "userId",
    "secret",
    "backupCodes",
    "verified",
    "failedVerificationCount",
    "lockedUntil",
  ],
  rateLimit: ["id", "key", "count", "lastRequest"],
};

const guardIndex = source.indexOf("requireStagingDatabaseTarget()");
const poolIndex = source.indexOf("new Pool(");
assert.ok(guardIndex >= 0, "Better Auth schema verifier must use the shared staging database target guard");
assert.ok(poolIndex > guardIndex, "staging database target guard must execute before Pool construction");
assert.match(source, /connectionString:\s*target\.databaseUrl/);
assert.match(source, /identityRow\.database_name !== target\.expectedDatabaseName/);

for (const [tableName, columns] of Object.entries(requiredPhysicalColumns)) {
  const declaration = new RegExp(
    `${tableName}:\\s*\\[([\\s\\S]*?)\\]`,
  ).exec(source)?.[1] ?? "";
  assert.ok(declaration, `missing REQUIRED_COLUMNS entry for ${tableName}`);
  for (const columnName of columns) {
    assert.match(
      declaration,
      new RegExp(`"${columnName}"`),
      `missing ${tableName}.${columnName} from Better Auth verifier`,
    );
  }
}

for (const columnName of [
  "image",
  "ipAddress",
  "userAgent",
  "accessToken",
  "refreshToken",
  "scope",
  "idToken",
  "password",
]) {
  assert.match(source, new RegExp(`\\["[^\"]+", "${columnName}"\\]`));
}
for (const columnName of [
  "expiresAt",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
  "createdAt",
  "updatedAt",
  "lockedUntil",
]) {
  assert.match(source, new RegExp(`"${columnName}"`));
}

assert.match(source, /BEGIN READ ONLY/);
assert.match(source, /information_schema\.columns/);
assert.match(source, /from pg_index idx/);
assert.match(source, /information_schema\.table_constraints/);
assert.doesNotMatch(source, /select\s+\*\s+from\s+"?(?:user|session|account|verification|twoFactor|rateLimit)"?/i);
assert.doesNotMatch(source, /\.(?:password|secret|backupCodes|accessToken|refreshToken)\s*[,)]/);

assert.match(source, /hasUniqueIndex\("user", \["email"\]\)/);
assert.match(source, /hasUniqueIndex\("session", \["token"\]\)/);
assert.match(source, /hasUniqueIndex\("account", \["issuer", "accountId"\]\)/);
assert.match(source, /hasUniqueIndex\("rateLimit", \["key"\]\)/);
assert.match(source, /\["session", "account", "twoFactor"\]/);
assert.match(source, /userId -> user\.id foreign key is missing/);

console.log("BETTER_AUTH_SCHEMA_VERIFIER_CONTRACT_PASS");
