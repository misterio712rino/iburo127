import "dotenv/config";

import { Pool } from "pg";
import { requireStagingAuthzFixtures } from "./staging-authz-fixture-guard";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`STAGING_AUTHZ_VERIFY_FAIL: ${message}`);
  process.exit(1);
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
let fixtures: ReturnType<typeof requireStagingAuthzFixtures>;
try {
  target = requireStagingDatabaseTarget();
  fixtures = requireStagingAuthzFixtures();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging authz target or fixture configuration");
}

const pool = new Pool({
  connectionString: target.databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");

  const identity = await client.query<{ database_name: string }>(
    "select current_database() as database_name",
  );
  if (identity.rows[0]?.database_name !== target.expectedDatabaseName) {
    fail("connected database does not match the preflight staging database identity");
  }

  for (const fixture of fixtures) {
    const result = await client.query<{
      status: string;
      role_code: string | null;
      mapped_user_id: string | null;
    }>(
      `
        select
          u."status"::text as status,
          r."code" as role_code,
          ai."userId"::text as mapped_user_id
        from "User" u
        left join "UserRole" ur on ur."userId" = u."id"
        left join "Role" r on r."id" = ur."roleId" and r."code" = $2
        left join "AuthIdentity" ai
          on ai."userId" = u."id"
         and ai."provider" = 'better-auth'
         and ai."subject" = $3
        where u."id" = $1::uuid
        limit 1
      `,
      [fixture.userId, fixture.requiredRole, fixture.subject],
    );

    const row = result.rows[0];
    if (!row) fail(`${fixture.label} internal user not found`);
    if (row.status !== "ACTIVE") fail(`${fixture.label} internal user is not ACTIVE`);
    if (row.role_code !== fixture.requiredRole) fail(`${fixture.label} required role is missing`);
    if (row.mapped_user_id !== fixture.userId) fail(`${fixture.label} Better Auth mapping is missing or mismatched`);

    console.log(`${fixture.label}: active user, role and AuthIdentity mapping verified`);
  }

  const lawyerCase = await client.query(
    `select 1 from "ClientCase" where "assignedLawyerId" = $1::uuid limit 1`,
    [fixtures[1].userId],
  );
  if (lawyerCase.rowCount !== 1) fail("LAWYER has no assigned staging ClientCase");

  const clientCase = await client.query(
    `select 1 from "ClientCase" where "clientId" = $1::uuid limit 1`,
    [fixtures[0].userId],
  );
  if (clientCase.rowCount !== 1) fail("CLIENT has no owned staging ClientCase");

  console.log("CLIENT ownership and LAWYER assignment fixtures verified");
  console.log("STAGING_AUTHZ_VERIFY_PASS");
  await client.query("ROLLBACK");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original failure.
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}
