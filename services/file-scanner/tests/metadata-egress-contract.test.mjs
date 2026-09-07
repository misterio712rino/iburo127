import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("staging scanner host can obtain a runtime IAM token without exposing metadata to containers", () => {
  const main = read("infra/file-scanner-staging/main.tf");
  const activate = read("services/file-scanner/deploy/activate-staging.sh");
  const cloudInit = read("infra/file-scanner-staging/cloud-init.yaml.tftpl");

  assert.match(
    activate,
    /METADATA_TOKEN_URL="http:\/\/169\.254\.169\.254\/computeMetadata\/v1\/instance\/service-accounts\/default\/token"/,
  );
  assert.match(activate, /--header 'Metadata-Flavor:Google'/);

  const egressBlocks = [...main.matchAll(/egress\s*\{([\s\S]*?)\n\s*\}/g)].map((match) => match[0]);
  const httpEgressBlocks = egressBlocks.filter((block) => /port\s*=\s*80/.test(block));
  assert.equal(httpEgressBlocks.length, 1, "only metadata may use outbound TCP/80");

  const metadataEgress = httpEgressBlocks[0];
  assert.match(metadataEgress, /description\s*=\s*"Yandex VM metadata for the runtime service-account IAM token"/);
  assert.match(metadataEgress, /protocol\s*=\s*"TCP"/);
  assert.match(metadataEgress, /v4_cidr_blocks\s*=\s*\["169\.254\.169\.254\/32"\]/);
  assert.doesNotMatch(metadataEgress, /0\.0\.0\.0\/0/);

  assert.match(
    cloudInit,
    /iptables -I DOCKER-USER 1 -d 169\.254\.169\.254\/32 -j REJECT/,
    "containers must remain blocked from the metadata service even though the VM host can reach it",
  );
});

test("staging scanner package bootstrap stays on HTTPS and does not require broad TCP/80", () => {
  const cloudInit = read("infra/file-scanner-staging/cloud-init.yaml.tftpl");

  assert.match(cloudInit, /apt:\n\s+preserve_sources_list:\s+false/);
  const httpsArchiveUris = cloudInit.match(/uri:\s+https:\/\/archive\.ubuntu\.com\/ubuntu/g) ?? [];
  assert.equal(httpsArchiveUris.length, 2, "primary and security APT mirrors must both use HTTPS");
  assert.doesNotMatch(cloudInit, /uri:\s+http:\/\//);
  assert.match(cloudInit, /package_update:\s+true/);
});

test("staging scanner package installation cannot auto-start public Caddy", () => {
  const cloudInit = read("infra/file-scanner-staging/cloud-init.yaml.tftpl");

  assert.match(cloudInit, /bootcmd:\n\s+- \[cloud-init-per, once, iburo-scanner-policy-rcd,/);
  assert.match(cloudInit, /echo '#!\/bin\/sh' > \/usr\/sbin\/policy-rc\.d/);
  assert.match(cloudInit, /echo 'exit 101' >> \/usr\/sbin\/policy-rc\.d/);
  assert.match(cloudInit, /touch \/run\/iburo-scanner-policy-rcd-created/);

  const cleanupIndex = cloudInit.indexOf("rm -f /usr/sbin/policy-rc.d /run/iburo-scanner-policy-rcd-created");
  const dockerStartIndex = cloudInit.indexOf("systemctl, enable, --now, docker");
  const caddyDisableIndex = cloudInit.indexOf("systemctl, disable, --now, caddy");
  assert.ok(cleanupIndex >= 0, "temporary package-service start policy must be removed deliberately");
  assert.ok(dockerStartIndex > cleanupIndex, "Docker must start only after the temporary package policy is removed");
  assert.ok(caddyDisableIndex > dockerStartIndex, "Caddy must stay disabled after package installation");
});
