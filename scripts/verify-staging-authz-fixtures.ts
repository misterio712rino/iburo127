import "dotenv/config";

import { Pool } from "pg";

function fail(message: string): never {
  console.error(`STAGING_AUTHZ_VERIFY_FAIL: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) fail("missing DATABASE_URL");

const fixtures = [
  {
    label: "CLIENT",
    userId: process.env.IB_STAGING_CLIENT_USER_ID?.trim(),
    subject: process.env.IB_STAGING_CLIENT_SUBJECT?.trim(),
    requiredRole: "CLIENT",
  },
  {
    label: "LAWYER",
    userId: process.env.IB_STAGING_LAWYER_USER_ID?.trim(),
    subject: process.env.IB_STAGING_LAWYER_SUBJECT?.trim(),
    requiredRole: "LAWYER",
  },
  {
    label: "MANAGER",
    userId: process.env.IB_STAGING_MANAGER_USER_ID?.trim(),
    subject: process.env.IB_STAGING_MANAGER_SUBJECT?.trim(),
    requiredRole: "MANAGER",
  },
] as const;

for (const fixture of fixtures) {
  if (!fixture.userId) fail(`missing IB_STAGING_${fixture.label}_USER_ID`);
  if (!fixture.subject) fail(`missing IB_STAGING_${fixture.label}_SUBJECT`);
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");

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
