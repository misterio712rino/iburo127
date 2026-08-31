import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve("scripts/verify-staging-better-auth-schema.ts"),
  "utf8",
);
const prismaConfigSource = await readFile(resolve("prisma.config.ts"), "utf8");
const deploySource = await readFile(
  resolve("scripts/apply-staging-better-auth-schema.ts"),
  "utf8",
);
const reviewedSql = await readFile(
  resolve("database/better-auth/1.7.2/schema.sql"),
  "utf8",
);
const prismaMigrationEntries = await readdir(resolve("prisma/migrations"), {
  withFileTypes: true,
});

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
assert.match(source, /const BETTER_AUTH_SCHEMA = "public"/);
assert.match(source, /expectedSchema !== BETTER_AUTH_SCHEMA/);

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

for (const nullableColumn of [
  "user.image",
  "user.twoFactorEnabled",
  "session.ipAddress",
  "session.userAgent",
  "account.accessToken",
  "account.refreshToken",
  "account.accessTokenExpiresAt",
  "account.refreshTokenExpiresAt",
  "account.scope",
  "account.idToken",
  "account.password",
  "twoFactor.verified",
  "twoFactor.failedVerificationCount",
  "twoFactor.lockedUntil",
]) {
  assert.match(source, new RegExp(`"${nullableColumn.replace(".", "\\.")}"`));
}
assert.match(source, /NULLABLE_COLUMNS\.has\(`\$\{tableName\}\.\$\{columnName\}`\)/);
assert.match(source, /column\.nullable !== expectedNullable/);
assert.match(source, /nullability mismatch/);

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
assert.match(source, /information_schema\.referential_constraints/);
assert.doesNotMatch(source, /select\s+\*\s+from\s+"?(?:user|session|account|verification|twoFactor|rateLimit)"?/i);
assert.doesNotMatch(source, /\.(?:password|secret|backupCodes|accessToken|refreshToken)\s*[,)]/);

assert.match(source, /hasIndex\("user", \["email"\], true\)/);
assert.match(source, /hasIndex\("session", \["token"\], true\)/);
assert.match(source, /hasIndex\("account", \["issuer", "accountId"\], true\)/);
assert.match(source, /hasIndex\("rateLimit", \["key"\], true\)/);
for (const supportingIndex of [
  '["session", ["userId"]]',
  '["account", ["userId"]]',
  '["verification", ["identifier"]]',
  '["twoFactor", ["secret"]]',
  '["twoFactor", ["userId"]]',
]) {
  assert.ok(source.includes(supportingIndex), `missing required supporting index contract ${supportingIndex}`);
}

assert.match(source, /\["session", "account", "twoFactor"\]/);
assert.match(source, /row\.delete_rule === "CASCADE"/);
assert.match(source, /userId -> user\.id foreign key with ON DELETE CASCADE is missing/);

assert.match(prismaConfigSource, /externalTables:\s*true/);
for (const tableName of Object.keys(requiredPhysicalColumns)) {
  assert.match(
    prismaConfigSource,
    new RegExp(`"public\\.${tableName}"`),
    `Prisma must declare public.${tableName} as externally managed`,
  );
}
assert.ok(
  !prismaMigrationEntries.some(
    (entry) => entry.isDirectory() && /better[-_]?auth/i.test(entry.name),
  ),
  "Better Auth SQL must not live inside prisma/migrations",
);

for (const tableName of Object.keys(requiredPhysicalColumns)) {
  assert.match(
    reviewedSql,
    new RegExp(`create table "${tableName}"`, "i"),
    `reviewed Better Auth SQL must create ${tableName}`,
  );
}
assert.match(deploySource, /requireStagingDatabaseTarget\(\)/);
assert.match(deploySource, /IB_RUNTIME_TARGET/);
assert.match(deploySource, /IB_STAGING_BETTER_AUTH_SQL_SHA256/);
assert.match(deploySource, /IB_STAGING_BETTER_AUTH_MIGRATION_CONFIRM/);
assert.match(deploySource, /BEGIN/);
assert.match(deploySource, /COMMIT/);
assert.match(deploySource, /STAGING_BETTER_AUTH_MIGRATION_PASS/);

console.log("BETTER_AUTH_SCHEMA_VERIFIER_CONTRACT_PASS");
