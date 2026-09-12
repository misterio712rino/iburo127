import "dotenv/config";

import { pathToFileURL } from "node:url";

import { buildProviderAwareStagingAiReadiness } from "./staging-ai-readiness";
import {
  buildStagingEnvironmentInventory,
  STAGING_ENVIRONMENT_PHASES,
  type StagingEnvironment,
  type StagingEnvironmentInventory,
  type StagingEnvironmentPhase,
} from "./staging-environment-inventory";

export function buildProviderAwareStagingEnvironmentInventory(
  env: StagingEnvironment,
): StagingEnvironmentInventory {
  const inventory = buildStagingEnvironmentInventory(env);
  const ai = buildProviderAwareStagingAiReadiness(env);

  return {
    ...inventory,
    phases: {
      ...inventory.phases,
      openai: {
        ready: ai.ready,
        requiredCount: ai.requiredCount,
        configuredCount: ai.configuredCount,
        missingOrPlaceholder: ai.missingOrPlaceholder,
        invalidOrInconsistent: ai.invalidOrInconsistent,
      },
    },
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

  const inventory = buildProviderAwareStagingEnvironmentInventory(process.env);
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
