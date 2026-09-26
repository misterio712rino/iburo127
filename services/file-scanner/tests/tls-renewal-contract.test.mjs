import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const scriptPath = resolve(root, "services/file-scanner/deploy/renew-staging-tls.sh");
const script = read("services/file-scanner/deploy/renew-staging-tls.sh");
const service = read("services/file-scanner/deploy/iburo-staging-tls-renew.service");
const timer = read("services/file-scanner/deploy/iburo-staging-tls-renew.timer");

test("renewal shell is syntactically valid and pinned to staging resources", () => {
  const syntax = spawnSync("sh", ["-n", scriptPath], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  assert.match(script, /CERTIFICATE_ID="fpqg6c69vqs7khjkhcmt"/);
  assert.match(script, /SCANNER_HOSTNAME="scanner-v2-staging\.iburo127\.online"/);
  assert.match(script, /data\.certificate-manager\.api\.cloud\.yandex\.net/);
  assert.match(script, /169\.254\.169\.254\/computeMetadata\/v1\/instance\/service-accounts\/default\/token/);
  assert.doesNotMatch(script, /production|prod-/i);
});

test("renewal keeps IAM token out of process arguments and removes secret temp files", () => {
  assert.match(script, /printf 'Authorization: Bearer %s\\n' "\$iam_token" > "\$auth_header"/);
  assert.match(script, /--header "@\$auth_header"/);
  assert.doesNotMatch(script, /--header "Authorization: Bearer \$\{?iam_token/);
  assert.match(script, /rm -f "\$payload_file"/);
  assert.match(script, /rm -rf "\$work_dir"/);
  assert.match(script, /umask 077/);
});

test("renewal is fail-closed before replacement and rolls back failed reload/HTTPS", () => {
  assert.match(script, /candidate-hostname/);
  assert.match(script, /candidate-insufficient-lifetime/);
  assert.match(script, /candidate-key-mismatch/);
  assert.match(script, /candidate-not-newer/);
  assert.match(script, /caddy validate --config "\$CADDYFILE" --adapter caddyfile/);
  assert.match(script, /rollback\(\)/);
  assert.match(script, /fail "caddy-reload"/);
  assert.match(script, /fail "post-reload-https"/);
  assert.match(script, /health_status/);
  assert.match(script, /"401"/);
});

test("renewal exports certificate content only inside the renewal window unless forced", () => {
  assert.match(script, /RENEW_WINDOW_DAYS="\$\{IB_TLS_RENEW_WINDOW_DAYS:-45\}"/);
  assert.match(script, /MIN_VALID_DAYS="\$\{IB_TLS_MIN_VALID_DAYS:-30\}"/);
  assert.match(script, /FORCE_CHECK="\$\{IB_TLS_RENEW_FORCE_CHECK:-0\}"/);
  assert.match(script, /STAGING_TLS_RENEW_NOT_DUE/);
  assert.match(script, /STAGING_TLS_RENEW_NOOP/);
});

test("systemd unit is root-only hardened and timer is daily persistent", () => {
  assert.match(service, /Type=oneshot/);
  assert.match(service, /ExecStart=\/usr\/local\/sbin\/iburo-staging-tls-renew/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /ReadWritePaths=\/srv\/iburo-file-scanner\/caddy\/certs \/run/);
  assert.match(service, /RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX/);
  assert.match(timer, /OnCalendar=\*-\*-\* 04:15:00 UTC/);
  assert.match(timer, /RandomizedDelaySec=45m/);
  assert.match(timer, /Persistent=true/);
});
