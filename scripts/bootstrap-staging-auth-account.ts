import "dotenv/config";

import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { requireReviewedStagingMutationPreflight } from "./staging-mutation-preflight";

const FAIL = "STAGING_AUTH_ACCOUNT_BOOTSTRAP_FAIL";
const PROVIDER = "better-auth";

type DomainUserRow = {
  id: string;
  status: string;
  email: string | null;
  displayName: string | null;
};

type BetterAuthUserRow = {
  id: string;
  email: string;
};

class StagingAuthAccountBootstrapFailure extends Error {}

function fail(message: string): never {
  throw new StagingAuthAccountBootstrapFailure(message);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function readInternalUserId(): string {
  const value = required("IB_AUTH_BOOTSTRAP_USER_ID");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail("IB_AUTH_BOOTSTRAP_USER_ID must be a UUID");
  }
  return value;
}

function readEmail(): string {
  const value = required("IB_AUTH_BOOTSTRAP_EMAIL").toLowerCase();
  if (value.length > 254 || /[\r\n\0]/.test(value) || !/^[^\s@]+@[^\s@]+$/.test(value)) {
    fail("IB_AUTH_BOOTSTRAP_EMAIL is invalid");
  }
  return value;
}

function readPassword(): string {
  const value = process.env.IB_AUTH_BOOTSTRAP_PASSWORD ?? "";
  if (value.length < 12 || value.length > 128 || /[\r\n\0]/.test(value)) {
    fail("IB_AUTH_BOOTSTRAP_PASSWORD must contain 12 to 128 safe characters");
  }
  return value;
}

function readAuthSecret(): string {
  const value = process.env.BETTER_AUTH_SECRET ?? "";
  if (value.length < 32 || /[\r\n\0]/.test(value)) {
    fail("BETTER_AUTH_SECRET is invalid");
  }
  return value;
}

function readAuthOrigin(): string {
  let parsed: URL;
  try {
    parsed = new URL(required("BETTER_AUTH_URL"));
  } catch {
    fail("BETTER_AUTH_URL must be a valid URL");
  }

  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  const secureProtocol = parsed.protocol === "https:" || (loopback && parsed.protocol === "http:");
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  if (!secureProtocol || !originOnly) fail("BETTER_AUTH_URL must be a secure origin");
  if (parsed.hostname === "iburo127.ru" || parsed.hostname === "www.iburo127.ru") {
    fail("production Better Auth hostname is explicitly blocked");
  }
  return parsed.origin;
}

async function readStagingTarget(userId: string) {
  try {
    return (
      await requireReviewedStagingMutationPreflight({
        env: process.env,
        confirmation: {
          variableName: "IB_AUTH_BOOTSTRAP_CONFIRM",
          expectedValue: (stagingTarget) =>
            `BOOTSTRAP-AUTH:${stagingTarget.expectedDatabaseName}:${userId}`,
        },
      })
    ).target;
  } catch (error) {
    fail(error instanceof Error ? error.message : "staging mutation preflight failed");
  }
}

const userId = readInternalUserId();
const email = readEmail();
const password = readPassword();
const secret = readAuthSecret();
const baseURL = readAuthOrigin();
const authSchema = required("IB_STAGING_BETTER_AUTH_SCHEMA");
if (authSchema !== "public") {
  fail('IB_STAGING_BETTER_AUTH_SCHEMA must be exactly "public" for the reviewed Better Auth schema');
}
const target = await readStagingTarget(userId);

const pool = new Pool({
  connectionString: target.databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 2,
});

let createdSubject: string | null = null;
let linked = false;

try {
  const domainUserResult = await pool.query<DomainUserRow>(
    `select id, status, email, "displayName" from "User" where id = $1::uuid`,
    [userId],
  );
  const domainUser = domainUserResult.rows[0];
  if (!domainUser || domainUser.status !== "ACTIVE") {
    fail("internal User must exist and be ACTIVE");
  }
  if (domainUser.email && domainUser.email.trim().toLowerCase() !== email) {
    fail("IB_AUTH_BOOTSTRAP_EMAIL does not match the internal User email");
  }

  const existingAuthUser = await pool.query<BetterAuthUserRow>(
    `select id, email from "user" where lower(email) = lower($1) limit 2`,
    [email],
  );
  if (existingAuthUser.rowCount !== 0) {
    fail("Better Auth account already exists for the requested email; use the guarded link/recovery procedure instead");
  }

  const auth = betterAuth({
    appName: "iБюро staging bootstrap",
    secret,
    baseURL,
    database: pool,
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    advanced: {
      database: {
        joins: true,
      },
    },
  });

  const name = domainUser.displayName?.trim() || domainUser.email?.trim() || "iБюро";
  const signUpResult = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
      rememberMe: false,
    },
  });
  const returnedSubject = signUpResult?.user?.id?.trim();
  if (!returnedSubject) fail("Better Auth did not return a created user subject");

  const persistedAuthUser = await pool.query<BetterAuthUserRow>(
    `select id, email from "user" where lower(email) = lower($1) limit 2`,
    [email],
  );
  const persisted = persistedAuthUser.rows[0];
  if (persistedAuthUser.rowCount !== 1 || !persisted || persisted.id !== returnedSubject) {
    fail("Better Auth persisted subject does not match the signup result");
  }
  createdSubject = persisted.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockedUser = await client.query<{ id: string; status: string }>(
      `select id, status from "User" where id = $1::uuid for update`,
      [userId],
    );
    if (lockedUser.rows[0]?.status !== "ACTIVE") {
      fail("internal User is no longer ACTIVE");
    }

    const existingIdentity = await client.query<{ userId: string }>(
      `select "userId" from "AuthIdentity" where provider = $1 and subject = $2`,
      [PROVIDER, createdSubject],
    );
    if (existingIdentity.rowCount !== 0) {
      fail("new Better Auth subject is already linked");
    }

    await client.query(
      `insert into "AuthIdentity" (id, "userId", provider, subject, "createdAt", "updatedAt") values ($1::uuid, $2::uuid, $3, $4, now(), now())`,
      [randomUUID(), userId, PROVIDER, createdSubject],
    );
    await client.query("COMMIT");
    linked = true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }

  console.log("STAGING_AUTH_ACCOUNT_BOOTSTRAP_PASS");
} catch (error) {
  if (createdSubject && !linked) {
    try {
      await pool.query(`delete from "user" where id = $1 and lower(email) = lower($2)`, [createdSubject, email]);
    } catch {
      console.error(`${FAIL}: cleanup of the newly created Better Auth account failed`);
      process.exitCode = 1;
    }
  }

  const message =
    error instanceof StagingAuthAccountBootstrapFailure
      ? error.message
      : "unexpected bootstrap failure";
  console.error(`${FAIL}: ${message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
