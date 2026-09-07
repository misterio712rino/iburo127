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

  const metadataEgress = main.match(
    /egress\s*\{\s*description\s*=\s*"Yandex VM metadata for the runtime service-account IAM token"[\s\S]*?\n\s*\}/,
  )?.[0];
  assert.ok(metadataEgress, "scanner security group must declare dedicated metadata egress");
  assert.match(metadataEgress, /protocol\s*=\s*"TCP"/);
  assert.match(metadataEgress, /v4_cidr_blocks\s*=\s*\["169\.254\.169\.254\/32"\]/);
  assert.match(metadataEgress, /port\s*=\s*80/);
  assert.doesNotMatch(metadataEgress, /0\.0\.0\.0\/0/);

  assert.match(
    cloudInit,
    /iptables -I DOCKER-USER 1 -d 169\.254\.169\.254\/32 -j REJECT/,
    "containers must remain blocked from the metadata service even though the VM host can reach it",
  );
});
