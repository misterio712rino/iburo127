import { stat } from "node:fs/promises";
import { join } from "node:path";
import { SafeScannerError } from "./errors.mjs";

async function firstExisting(directory, names, statImpl) {
  for (const name of names) {
    try {
      const metadata = await statImpl(join(directory, name));
      if (typeof metadata.isFile !== "function" || !metadata.isFile() || metadata.size <= 0) continue;
      return metadata;
    } catch {
      // Try the alternate CVD/CLD representation without exposing filesystem details.
    }
  }
  throw new SafeScannerError("SIGNATURES_UNAVAILABLE", 503);
}

export async function assertSignaturesFresh(config, dependencies = {}) {
  const statImpl = dependencies.stat ?? stat;
  const now = dependencies.now?.() ?? Date.now();
  await firstExisting(config.signatureDirectory, ["main.cvd", "main.cld"], statImpl);
  const daily = await firstExisting(config.signatureDirectory, ["daily.cvd", "daily.cld"], statImpl);
  const maximumAgeMs = config.signatureMaxAgeHours * 60 * 60 * 1000;
  if (!Number.isFinite(daily.mtimeMs) || daily.mtimeMs > now || now - daily.mtimeMs > maximumAgeMs) {
    throw new SafeScannerError("SIGNATURES_STALE", 503);
  }
}
