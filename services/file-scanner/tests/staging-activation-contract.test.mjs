import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const activate = read("services/file-scanner/deploy/activate-staging.sh");
const bootstrap = read("services/file-scanner/deploy/bootstrap-staging-runtime.sh");
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
  assert.match(activate, /SIGNATURE_DIRECTORY="\/srv\/iburo-file-scanner\/clamav"/);
  assert.match(activate, /chmod 0701 "\$SIGNATURE_DIRECTORY"/);
  assert.match(activate, /stat -c '%a' "\$SIGNATURE_DIRECTORY"/);
  assert.match(activate, /docker compose --env-file "\$IMAGE_ENV" -f "\$COMPOSE_FILE" pull scanner/);
  assert.match(activate, /docker compose --env-file "\$IMAGE_ENV" -f "\$COMPOSE_FILE" up -d --pull never scanner/);
  assert.match(compose, /image: "\$\{SCANNER_IMAGE:\?[^}]+\}@\$\{SCANNER_IMAGE_DIGEST:\?[^}]+\}"/);
  assert.match(compose, /restart: "no"/);
  assert.match(bootstrap, /docker inspect --format '\{\{\.State\.Status\}\}' iburo-file-scanner-staging/);
  assert.doesNotMatch(activate, /:latest|docker push|terraform|yc\s|kubectl|IB_FILE_SCANNER_SECRET=/i);
  assert.doesNotMatch(activate, /iburo127\.ru|www\.iburo127\.ru|api\.iburo127\.ru/i);
});

test("staging bootstrap retrieves one bounded scanner secret from Lockbox without logging it", () => {
  assert.match(
    bootstrap,
    /METADATA_TOKEN_URL="http:\/\/169\.254\.169\.254\/computeMetadata\/v1\/instance\/service-accounts\/default\/token"/,
  );
  assert.match(bootstrap, /Metadata-Flavor:Google/);
  assert.match(
    bootstrap,
    /LOCKBOX_PAYLOAD_BASE="https:\/\/payload\.lockbox\.api\.cloud\.yandex\.net\/lockbox\/v1\/secrets"/,
  );
  assert.match(bootstrap, /select\(\.key == "IB_FILE_SCANNER_SECRET"\)/);
  assert.match(bootstrap, /\[ "\$entry_count" = "1" \]/);
  assert.match(bootstrap, /select\(length >= 32\)/);
  assert.match(bootstrap, /SCANNER_ENV="\/etc\/iburo-file-scanner\/scanner\.env"/);
  assert.match(bootstrap, /chown root:root "\$SCANNER_ENV_TMP"/);
  assert.match(bootstrap, /chmod 0600 "\$SCANNER_ENV_TMP"/);
  assert.match(bootstrap, /"\$ACTIVATE_SCRIPT"/);
  assert.match(bootstrap, /http:\/\/127\.0\.0\.1:8080\/health/);
  assert.match(bootstrap, /TLS_CERT_FILE="\/srv\/iburo-file-scanner\/caddy\/certs\/chain\.pem"/);
  assert.match(bootstrap, /TLS_KEY_FILE="\/srv\/iburo-file-scanner\/caddy\/certs\/key\.pem"/);
  assert.match(bootstrap, /tls \$\{TLS_CERT_FILE\} \$\{TLS_KEY_FILE\}/);
  assert.match(bootstrap, /request_body \{\s+max_size 8KB\s+\}/);
  assert.match(bootstrap, /caddy validate --config "\$CADDYFILE_TMP" --adapter caddyfile/);
  assert.match(bootstrap, /systemctl reload caddy/);
  assert.doesNotMatch(bootstrap, /systemctl restart caddy/);
  assert.match(bootstrap, /fail "caddy reload failed"/);
  assert.match(bootstrap, /unset iam_token payload scanner_secret entry_count/);
  assert.doesNotMatch(bootstrap, /echo\s+"?\$scanner_secret|printf[^\n]*\$scanner_secret[^\n]*stdout/i);
  assert.doesNotMatch(bootstrap, /:latest|docker push|terraform|kubectl/i);
  assert.doesNotMatch(bootstrap, /(^|[^.a-z0-9-])(www\.|api\.)?iburo127\.ru([^a-z0-9.-]|$)/i);
});

test("cloud-init activates only through the explicit Lockbox bootstrap gate", () => {
  assert.match(
    terraform,
    /scanner_activate_b64\s*=\s*filebase64\("\$\{path\.module\}\/\.\.\/\.\.\/services\/file-scanner\/deploy\/activate-staging\.sh"\)/,
  );
  assert.match(
    terraform,
    /scanner_bootstrap_b64\s*=\s*filebase64\("\$\{path\.module\}\/\.\.\/\.\.\/services\/file-scanner\/deploy\/bootstrap-staging-runtime\.sh"\)/,
  );
  assert.match(terraform, /scanner_activate_b64\s*=\s*local\.scanner_activate_b64/);
  assert.match(terraform, /scanner_bootstrap_b64\s*=\s*local\.scanner_bootstrap_b64/);
  assert.match(
    terraform,
    /scanner_activation_enabled\s*=\s*var\.tls_activation_enabled && var\.scanner_hostname != "" && var\.scanner_lockbox_id != ""/,
  );
  assert.match(terraform, /var\.scanner_hostname != "" && var\.scanner_lockbox_id != ""/);

  assert.match(cloudInit, /- curl/);
  assert.match(cloudInit, /- jq/);
  assert.match(cloudInit, /path: \/usr\/local\/sbin\/iburo-file-scanner-activate/);
  assert.match(cloudInit, /content: \$\{scanner_activate_b64\}/);
  assert.match(cloudInit, /path: \/usr\/local\/sbin\/iburo-file-scanner-bootstrap/);
  assert.match(cloudInit, /content: \$\{scanner_bootstrap_b64\}/);
  assert.match(cloudInit, /path: \/etc\/iburo-file-scanner\/bootstrap\.env/);
  assert.match(
    cloudInit,
    /install, -d, -m, "0701", -o, root, -g, root, \/srv\/iburo-file-scanner\/clamav/,
  );
  assert.match(cloudInit, /SCANNER_LOCKBOX_SECRET_ID=\$\{scanner_lockbox_secret_id\}/);
  assert.doesNotMatch(cloudInit, /IB_FILE_SCANNER_SECRET=/);

  const runCommands = cloudInit.split("runcmd:", 2)[1] ?? "";
  assert.match(runCommands, /systemctl, disable, --now, caddy/);
  assert.match(
    runCommands,
    /if \[ '\$\{scanner_activation_enabled\}' = 'true' \]; then \/usr\/local\/sbin\/iburo-file-scanner-bootstrap; fi/,
  );
  assert.doesNotMatch(runCommands, /iburo-file-scanner-activate|docker compose|docker login|docker pull/);
});
