import assert from "node:assert/strict";
import { readScannerConfig } from "./src/config.mjs";
import { assertSignaturesFresh } from "./src/signature-freshness.mjs";
import { pingClamd, openClamdInstream } from "./src/clamd-client.mjs";

const config = readScannerConfig();
assert.equal(config.clamdHost, "127.0.0.1");
assert.equal(config.signatureDirectory, "/var/lib/clamav");
await assertSignaturesFresh(config);
await pingClamd(config);

async function inspect(buffer) {
  const stream = await openClamdInstream(config);
  try {
    await stream.writeChunk(buffer);
    return await stream.finish();
  } finally {
    stream.destroy();
  }
}

const clean = Buffer.from("iBuro isolated synthetic clean-file test\n", "utf8");
const eicar = Buffer.from(String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`, "ascii");
assert.equal(eicar.length, 68, "the standard harmless EICAR fixture must be exact");
assert.equal(await inspect(clean), "CLEAN", "real clamd must accept the clean fixture");
assert.equal(await inspect(eicar), "MALICIOUS", "real clamd must reject the EICAR fixture");
console.log("ISOLATED_CLAMD_FRESH_SIGNATURES_CLEAN_EICAR_PASS");