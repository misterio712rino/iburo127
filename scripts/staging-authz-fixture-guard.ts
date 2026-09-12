export type StagingAuthzEnvironment = Readonly<Record<string, string | undefined>>;

export type StagingAuthzFixture = Readonly<{
  label: "CLIENT" | "LAWYER" | "MANAGER";
  userId: string;
  subject: string;
  requiredRole: "CLIENT" | "LAWYER" | "MANAGER";
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT_MAX_LENGTH = 255;

function requireValue(env: StagingAuthzEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function requireUuid(env: StagingAuthzEnvironment, name: string): string {
  const value = requireValue(env, name);
  if (!UUID_PATTERN.test(value)) throw new Error(`${name} must be a canonical UUID`);
  return value.toLowerCase();
}

function requireSubject(env: StagingAuthzEnvironment, name: string): string {
  const value = requireValue(env, name);
  if (value.length > SUBJECT_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${name} must be a safe opaque subject`);
  }
  return value;
}

export function requireStagingAuthzFixtures(
  env: StagingAuthzEnvironment = process.env,
): readonly StagingAuthzFixture[] {
  const fixtures = [
    {
      label: "CLIENT",
      userId: requireUuid(env, "IB_STAGING_CLIENT_USER_ID"),
      subject: requireSubject(env, "IB_STAGING_CLIENT_SUBJECT"),
      requiredRole: "CLIENT",
    },
    {
      label: "LAWYER",
      userId: requireUuid(env, "IB_STAGING_LAWYER_USER_ID"),
      subject: requireSubject(env, "IB_STAGING_LAWYER_SUBJECT"),
      requiredRole: "LAWYER",
    },
    {
      label: "MANAGER",
      userId: requireUuid(env, "IB_STAGING_MANAGER_USER_ID"),
      subject: requireSubject(env, "IB_STAGING_MANAGER_SUBJECT"),
      requiredRole: "MANAGER",
    },
  ] as const;

  if (new Set(fixtures.map((fixture) => fixture.userId)).size !== fixtures.length) {
    throw new Error("staging authz fixture user IDs must be distinct");
  }
  if (new Set(fixtures.map((fixture) => fixture.subject)).size !== fixtures.length) {
    throw new Error("staging authz fixture Better Auth subjects must be distinct");
  }

  return fixtures;
}
