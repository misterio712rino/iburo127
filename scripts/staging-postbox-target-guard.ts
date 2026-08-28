export const STAGING_POSTBOX_TARGET_GUARD = "STAGING_POSTBOX_TARGET_GUARD";
export const STAGING_POSTBOX_SIMULATOR_RECIPIENT = "success@simulator.pstbx.ru";

export type StagingPostboxTarget = {
  fromEmail: string;
  accessKeyId: string;
};

type Env = Readonly<Record<string, string | undefined>>;

function requireValue(env: Env, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${STAGING_POSTBOX_TARGET_GUARD}:MISSING_${name}`);
  return value;
}

export function assertStagingPostboxTarget(env: Env): StagingPostboxTarget {
  if (env.IB_EMAIL_TARGET?.trim() !== "staging") {
    throw new Error(`${STAGING_POSTBOX_TARGET_GUARD}:TARGET`);
  }

  const configuredFromEmail = requireValue(env, "YANDEX_POSTBOX_FROM_EMAIL");
  const expectedFromEmail = requireValue(env, "IB_STAGING_POSTBOX_FROM_EMAIL");
  if (configuredFromEmail !== expectedFromEmail) {
    throw new Error(`${STAGING_POSTBOX_TARGET_GUARD}:FROM_EMAIL_MISMATCH`);
  }

  const configuredAccessKeyId = requireValue(env, "YANDEX_POSTBOX_ACCESS_KEY_ID");
  const expectedAccessKeyId = requireValue(env, "IB_STAGING_POSTBOX_ACCESS_KEY_ID");
  if (configuredAccessKeyId !== expectedAccessKeyId) {
    throw new Error(`${STAGING_POSTBOX_TARGET_GUARD}:ACCESS_KEY_MISMATCH`);
  }

  const expectedConfirmation = `SIMULATOR:${expectedFromEmail}`;
  if (env.IB_STAGING_POSTBOX_CONFIRM?.trim() !== expectedConfirmation) {
    throw new Error(`${STAGING_POSTBOX_TARGET_GUARD}:CONFIRMATION`);
  }

  return {
    fromEmail: configuredFromEmail,
    accessKeyId: configuredAccessKeyId,
  };
}
