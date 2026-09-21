import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const smokeScript = readFileSync("services/file-scanner/isolated-clamd-smoke.mjs", "utf8");
const step = workflow.split("- name: Isolated real ClamAV CLEAN and EICAR smoke")[1]?.split("- name: Setup Terraform")[0] ?? "";

test("real scanner smoke is scoped to a single explicit audit-branch push", () => {
  assert.match(step, /github\.event_name == 'push'/);
  assert.match(step, /github\.ref == 'refs\/heads\/audit\/production-readiness'/);
  assert.match(step, /contains\(github\.event\.head_commit\.message, '\[isolated-scanner-smoke\]'\)/);
  assert.match(step, /IB_SCANNER_SEED_SIGNATURES=1/);
  assert.match(step, /docker run --detach --name "\$container" --network none/);
  assert.match(step, /trap 'docker rm -f "\$container"/);
  assert.match(step, /< services\/file-scanner\/isolated-clamd-smoke\.mjs/);
  assert.doesNotMatch(step, /terraform|yc\s|kubectl|docker push|BLOB_READ_WRITE_TOKEN|DATABASE_URL|secrets\./i);
});

test("isolated smoke uses a real localhost clamd and synthetic CLEAN/EICAR inputs", () => {
  assert.match(smokeScript, /assertSignaturesFresh\(config\)/);
  assert.match(smokeScript, /pingClamd\(config\)/);
  assert.match(smokeScript, /openClamdInstream\(config\)/);
  assert.match(smokeScript, /assert\.equal\(await inspect\(clean\), "CLEAN"/);
  assert.match(smokeScript, /assert\.equal\(await inspect\(eicar\), "MALICIOUS"/);
  assert.doesNotMatch(smokeScript, /https?:\/\/|BLOB_READ_WRITE_TOKEN|DATABASE_URL|fetch\(/i);
});