import "dotenv/config";

import { pathToFileURL } from "node:url";

export type StagingEnvironment = Readonly<Record<string, string | undefined>>;

export const STAGING_ENVIRONMENT_PHASES = {
  database: [
    "DATABASE_URL",
    "IB_DB_TARGET",
    "IB_STAGING_DATABASE_HOST",
    "IB_STAGING_DATABASE_NAME",
    "IB_STAGING_DATABASE_USER",
    "IB_STAGING_BETTER_AUTH_SCHEMA",
  ],
  auth: ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
  storage: [
    "IB_STORAGE_TARGET",
    "IB_STAGING_STORAGE_BUCKET",
    "IB_STAGING_STORAGE_ALLOWED_ORIGIN",
    "IB_STAGING_STORAGE_ACCESS_KEY_ID",
    "YANDEX_STORAGE_BUCKET",
    "YANDEX_STORAGE_ACCESS_KEY_ID",
    "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  ],
  scanner: [
    "IB_FILE_SCANNER_TARGET",
    "IB_FILE_SCANNER_ORIGIN",
    "IB_FILE_SCANNER_SECRET",
    "IB_STAGING_FILE_SCANNER_ORIGIN",
    "IB_STAGING_FILE_SCANNER_SECRET_SHA256",
    "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY",
    "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
    "IB_STAGING_FILE_SCANNER_CONFIRM",
  ],
  applicationE2e: [
    "IB_STAGING_BASE_URL",
    "IB_STAGING_CLIENT_COOKIE",
    "IB_STAGING_LAWYER_COOKIE",
    "IB_STAGING_MANAGER_COOKIE",
    "IB_STAGING_CLIENT_CASE_NUMBER",
    "IB_STAGING_LAWYER_CASE_NUMBER",
    "IB_STAGING_CLIENT_AI_CASE_NUMBER",
    "IB_STAGING_CLIENT_NO_AI_CASE_NUMBER",
    "IB_STAGING_MUTATION_TARGET",
    "IB_STAGING_MUTATION_CONFIRM",
    "IB_STAGING_MUTATION_CASE_NUMBER",
    "IB_STAGING_MUTATION_TASK_ID",
  ],
  postbox: [
    "IB_EMAIL_TARGET",
    "YANDEX_POSTBOX_FROM_EMAIL",
    "YANDEX_POSTBOX_ACCESS_KEY_ID",
    "YANDEX_POSTBOX_SECRET_ACCESS_KEY",
    "IB_STAGING_POSTBOX_FROM_EMAIL",
    "IB_STAGING_POSTBOX_ACCESS_KEY_ID",
    "IB_STAGING_POSTBOX_CONFIRM",
  ],
  openai: [
    "IB_AI_TARGET",
    "OPENAI_API_KEY",
    "IB_AI_OPENAI_MODEL",
    "IB_STAGING_OPENAI_MODEL",
    "IB_STAGING_OPENAI_KEY_SHA256",
    "IB_STAGING_AI_CONFIRM",
  ],
  bitrix24: [
    "IB_BITRIX24_TARGET",
    "BITRIX24_PORTAL_ORIGIN",
    "IB_BITRIX24_ALLOWED_HOST",
    "BITRIX24_WEBHOOK_USER_ID",
    "BITRIX24_WEBHOOK_SECRET",
    "BITRIX24_CASE_ENTITY_TYPE_ID",
    "BITRIX24_CASE_FIELD_MAP",
    "IB_STAGING_BITRIX24_PORTAL_ORIGIN",
    "IB_STAGING_BITRIX24_WEBHOOK_USER_ID",
    "IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256",
    "IB_STAGING_BITRIX24_CONFIRM",
  ],
  maintenance: ["IB_MAINTENANCE_SECRET", "IB_MAINTENANCE_BASE_URL"],
} as const;

export type StagingEnvironmentPhase = keyof typeof STAGING_ENVIRONMENT_PHASES;

const PLACEHOLDER_PATTERNS = [
  /replace-with/i,
  /example\.com/i,
  /example\.net/i,
  /postgresql:\/\/USER:PASSWORD@HOST/i,
];

function isConfigured(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export type StagingEnvironmentInventory = {
  networkAccessed: false;
  valuesPrinted: false;
  phases: Record<
    StagingEnvironmentPhase,
    {
      ready: boolean;
      requiredCount: number;
      configuredCount: number;
      missingOrPlaceholder: string[];
    }
  >;
};

export function buildStagingEnvironmentInventory(
  env: StagingEnvironment,
): StagingEnvironmentInventory {
  const phaseEntries = Object.entries(STAGING_ENVIRONMENT_PHASES).map(([phase, required]) => {
    const missingOrPlaceholder = required.filter((name) => !isConfigured(env[name]));
    return [
      phase,
      {
        ready: missingOrPlaceholder.length === 0,
        requiredCount: required.length,
        configuredCount: required.length - missingOrPlaceholder.length,
        missingOrPlaceholder,
      },
    ] as const;
  });

  return {
    networkAccessed: false,
    valuesPrinted: false,
    phases: Object.fromEntries(phaseEntries) as StagingEnvironmentInventory["phases"],
  };
}

function parseRequestedPhase(argv: readonly string[]): StagingEnvironmentPhase | null {
  const raw = argv.find((value) => value.startsWith("--phase="))?.slice("--phase=".length);
  if (!raw) return null;
  if (!(raw in STAGING_ENVIRONMENT_PHASES)) {
    throw new Error(
      `unknown phase ${raw}; expected one of ${Object.keys(STAGING_ENVIRONMENT_PHASES).join(", ")}`,
    );
  }
  return raw as StagingEnvironmentPhase;
}

function printableInventory(
  inventory: StagingEnvironmentInventory,
  requestedPhase: StagingEnvironmentPhase | null,
) {
  return requestedPhase
    ? {
        networkAccessed: false,
        valuesPrinted: false,
        phases: { [requestedPhase]: inventory.phases[requestedPhase] },
      }
    : inventory;
}

async function main() {
  let requestedPhase: StagingEnvironmentPhase | null;
  try {
    requestedPhase = parseRequestedPhase(process.argv.slice(2));
  } catch (error) {
    console.error(
      `STAGING_ENV_INVENTORY_FAIL: ${error instanceof Error ? error.message : "invalid arguments"}`,
    );
    process.exitCode = 1;
    return;
  }

  const inventory = buildStagingEnvironmentInventory(process.env);
  const output = printableInventory(inventory, requestedPhase);
  console.log(JSON.stringify(output, null, 2));

  const phases = requestedPhase ? [inventory.phases[requestedPhase]] : Object.values(inventory.phases);
  const ready = phases.every((phase) => phase.ready);
  console.error(ready ? "STAGING_ENV_INVENTORY_READY" : "STAGING_ENV_INVENTORY_INCOMPLETE");
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  await main();
}
