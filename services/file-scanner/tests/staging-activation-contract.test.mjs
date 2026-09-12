import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const activate = read("services/file-scanner/deploy/activate-staging.sh");
const compose = read("services/file-scanner/deploy/docker-compose.staging.yml");
const cloudInit = read("infra/file-scanner-staging/cloud-init.yaml.tftpl");
const terraform = read("infra/file-scanner-staging/main.tf");

test("staging activation uses ephemeral VM service-account registry authentication", () => {
  assert.match(
    activate,
    /http:\/\/169\.254\.169\.254\/computeMetadata\/v1\/instance\/service-accounts\/default\/token/,
  );
  assert.match(activate, /Metadata-Flavor:Google/);
  assert.match(activate, /jq -er '\.access_token \| strings \| select\(length > 0\)'/);
  assert.match(activate, /mktemp -d \/run\/iburo-scanner-docker-config\.XXXXXX/);
  assert.match(activate, /export DOCKER_CONFIG="\$DOCKER_CONFIG_DIR"/);
  assert.match(
    activate,
    /printf '%s' "\$iam_token" \| docker login "\$REGISTRY_HOST" --username iam --password-stdin/,
  );
  assert.match(activate, /docker logout "\$REGISTRY_HOST"/);
  assert.match(activate, /rm -rf "\$DOCKER_CONFIG_DIR"/);
  assert.match(activate, /unset iam_token/);
});

test("staging activation remains explicit, digest-pinned and secret-file bounded", () => {
  assert.match(activate, /SCANNER_ENV="\/etc\/iburo-file-scanner\/scanner\.env"/);
  assert.match(activate, /stat -c '%U:%G' "\$SCANNER_ENV"/);
  assert.match(activate, /stat -c '%a' "\$SCANNER_ENV"/);
  assert.match(activate, /docker compose --env-file "\$IMAGE_ENV" -f "\$COMPOSE_FILE" pull scanner/);
  assert.match(activate, /docker compose --env-file "\$IMAGE_ENV" -f "\$COMPOSE_FILE" up -d --pull never scanner/);
  assert.match(compose, /image: "\$\{SCANNER_IMAGE:\?[^}]+\}@\$\{SCANNER_IMAGE_DIGEST:\?[^}]+\}"/);
  assert.doesNotMatch(activate, /:latest|docker push|terraform|yc\s|kubectl|IB_FILE_SCANNER_SECRET=/i);
  assert.doesNotMatch(activate, /iburo127\.ru|www\.iburo127\.ru|api\.iburo127\.ru/i);
});

test("cloud-init installs but never executes the activation helper", () => {
  assert.match(terraform, /scanner_activate_b64\s*=\s*filebase64\("\$\{path\.module\}\/\.\.\/\.\.\/services\/file-scanner\/deploy\/activate-staging\.sh"\)/);
  assert.match(terraform, /scanner_activate_b64\s*=\s*local\.scanner_activate_b64/);
  assert.match(cloudInit, /- curl/);
  assert.match(cloudInit, /- jq/);
  assert.match(cloudInit, /path: \/usr\/local\/sbin\/iburo-file-scanner-activate/);
  assert.match(cloudInit, /permissions: "0750"/);
  assert.match(cloudInit, /content: \$\{scanner_activate_b64\}/);

  const runCommands = cloudInit.split("runcmd:", 2)[1] ?? "";
  assert.doesNotMatch(runCommands, /iburo-file-scanner-activate|docker compose|docker login|docker pull/);
  assert.match(runCommands, /systemctl, disable, --now, caddy/);
});
