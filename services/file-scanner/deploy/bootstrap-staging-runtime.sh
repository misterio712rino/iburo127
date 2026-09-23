#!/bin/sh
set -eu

umask 077

BOOTSTRAP_ENV="/etc/iburo-file-scanner/bootstrap.env"
SCANNER_ENV="/etc/iburo-file-scanner/scanner.env"
ACTIVATE_SCRIPT="/usr/local/sbin/iburo-file-scanner-activate"
METADATA_TOKEN_URL="http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"
LOCKBOX_PAYLOAD_BASE="https://payload.lockbox.api.cloud.yandex.net/lockbox/v1/secrets"
CADDYFILE="/etc/caddy/Caddyfile"
TLS_CERT_FILE="/srv/iburo-file-scanner/caddy/certs/chain.pem"
TLS_KEY_FILE="/srv/iburo-file-scanner/caddy/certs/key.pem"

fail() {
  printf '%s\n' "STAGING_FILE_SCANNER_BOOTSTRAP_FAIL: $1" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || fail "root required"
[ -f "$BOOTSTRAP_ENV" ] || fail "bootstrap env missing"
[ -x "$ACTIVATE_SCRIPT" ] || fail "activation script missing"

# shellcheck disable=SC1090
. "$BOOTSTRAP_ENV"

[ -n "${SCANNER_LOCKBOX_SECRET_ID:-}" ] || fail "lockbox secret id missing"
[ -n "${SCANNER_HOSTNAME:-}" ] || fail "scanner hostname missing"

case "$SCANNER_HOSTNAME" in
  *[!a-z0-9.-]*|.*|*..*|*.) fail "scanner hostname invalid" ;;
esac

command -v curl >/dev/null 2>&1 || fail "curl unavailable"
command -v jq >/dev/null 2>&1 || fail "jq unavailable"
command -v caddy >/dev/null 2>&1 || fail "caddy unavailable"
command -v docker >/dev/null 2>&1 || fail "docker unavailable"

printf '%s\n' "STAGING_FILE_SCANNER_LOCKBOX_BOOTSTRAP_START"

iam_token="$(
  curl \
    --silent \
    --show-error \
    --fail \
    --connect-timeout 2 \
    --max-time 8 \
    --header 'Metadata-Flavor:Google' \
    "$METADATA_TOKEN_URL" \
  | jq -er '.access_token | strings | select(length > 0)'
)" || fail "service-account metadata token unavailable"

payload="$(
  curl \
    --silent \
    --show-error \
    --fail \
    --connect-timeout 3 \
    --max-time 12 \
    --header "Authorization: Bearer ${iam_token}" \
    "${LOCKBOX_PAYLOAD_BASE}/${SCANNER_LOCKBOX_SECRET_ID}/payload"
)" || fail "lockbox payload unavailable"

entry_count="$(
  printf '%s' "$payload" \
  | jq -er '[.entries[]? | select(.key == "IB_FILE_SCANNER_SECRET") | .textValue] | length'
)" || fail "lockbox payload invalid"

[ "$entry_count" = "1" ] || fail "lockbox secret entry count invalid"

scanner_secret="$(
  printf '%s' "$payload" \
  | jq -er '.entries[] | select(.key == "IB_FILE_SCANNER_SECRET") | .textValue | strings | select(length >= 32)'
)" || fail "scanner secret invalid"

printf '%s' "$scanner_secret" | grep -Eq '^[A-Za-z0-9._~-]{32,256}$' \
  || fail "scanner secret contains unsupported characters"

SCANNER_ENV_TMP="$(mktemp /etc/iburo-file-scanner/scanner.env.XXXXXX)"
printf 'IB_FILE_SCANNER_SECRET=%s\n' "$scanner_secret" > "$SCANNER_ENV_TMP"
chown root:root "$SCANNER_ENV_TMP"
chmod 0600 "$SCANNER_ENV_TMP"
mv -f "$SCANNER_ENV_TMP" "$SCANNER_ENV"

unset iam_token payload scanner_secret entry_count

printf '%s\n' "STAGING_FILE_SCANNER_SECRET_INSTALLED"

"$ACTIVATE_SCRIPT"

printf '%s\n' "STAGING_FILE_SCANNER_LOCAL_HEALTH_WAIT"

health_ok=0
for _attempt in $(seq 1 360); do
  # shellcheck disable=SC1090
  . "$SCANNER_ENV"

  if curl \
    --silent \
    --show-error \
    --fail \
    --connect-timeout 2 \
    --max-time 8 \
    --header "Authorization: Bearer ${IB_FILE_SCANNER_SECRET}" \
    http://127.0.0.1:8080/health \
    | jq -e '.status == "ok"' >/dev/null 2>&1
  then
    unset IB_FILE_SCANNER_SECRET
    health_ok=1
    break
  fi

  unset IB_FILE_SCANNER_SECRET

  if [ $((_attempt % 24)) -eq 0 ]; then
    printf '%s\n' "STAGING_FILE_SCANNER_LOCAL_HEALTH_PENDING:${_attempt}"
  fi

  sleep 5
done

if [ "$health_ok" != "1" ]; then
  # Never emit arbitrary container logs: they have not been proved safe for operator output.
  printf '%s\n' "STAGING_FILE_SCANNER_LOCAL_HEALTH_TIMEOUT" >&2
  fail "local scanner health timeout"
fi

printf '%s\n' "STAGING_FILE_SCANNER_LOCAL_HEALTH_PASS"

[ -f "$TLS_CERT_FILE" ] || fail "TLS certificate missing"
[ -f "$TLS_KEY_FILE" ] || fail "TLS private key missing"
[ "$(stat -c '%U:%G' "$TLS_CERT_FILE")" = "root:caddy" ] || fail "TLS certificate owner invalid"
[ "$(stat -c '%a' "$TLS_CERT_FILE")" = "644" ] || fail "TLS certificate mode invalid"
[ "$(stat -c '%U:%G' "$TLS_KEY_FILE")" = "root:caddy" ] || fail "TLS private key owner invalid"
[ "$(stat -c '%a' "$TLS_KEY_FILE")" = "640" ] || fail "TLS private key mode invalid"

CADDYFILE_TMP="$(mktemp /etc/caddy/Caddyfile.XXXXXX)"
CADDYFILE_BACKUP="$(mktemp /etc/caddy/Caddyfile.backup.XXXXXX)"
had_caddyfile=0

cat > "$CADDYFILE_TMP" <<EOF
${SCANNER_HOSTNAME} {
  tls ${TLS_CERT_FILE} ${TLS_KEY_FILE}

  request_body {
    max_size 8KB
  }

  reverse_proxy 127.0.0.1:8080 {
    transport http {
      dial_timeout 5s
      response_header_timeout 60s
    }
  }

  header -Server
}
EOF

chown root:root "$CADDYFILE_TMP"
chmod 0644 "$CADDYFILE_TMP"
caddy validate --config "$CADDYFILE_TMP" >/dev/null

if [ -f "$CADDYFILE" ]; then
  cp -p "$CADDYFILE" "$CADDYFILE_BACKUP"
  had_caddyfile=1
fi

mv -f "$CADDYFILE_TMP" "$CADDYFILE"
systemctl enable caddy >/dev/null

if systemctl is-active --quiet caddy; then
  if ! systemctl reload caddy; then
    if [ "$had_caddyfile" = "1" ]; then
      mv -f "$CADDYFILE_BACKUP" "$CADDYFILE"
      caddy validate --config "$CADDYFILE" >/dev/null 2>&1 || true
      systemctl reload caddy >/dev/null 2>&1 || true
    else
      rm -f "$CADDYFILE"
    fi
    fail "caddy reload failed"
  fi
else
  if ! systemctl start caddy; then
    if [ "$had_caddyfile" = "1" ]; then
      mv -f "$CADDYFILE_BACKUP" "$CADDYFILE"
    else
      rm -f "$CADDYFILE"
    fi
    fail "caddy start failed"
  fi
fi

rm -f "$CADDYFILE_BACKUP"
printf '%s\n' "STAGING_FILE_SCANNER_CADDY_STARTED"
printf '%s\n' "STAGING_FILE_SCANNER_BOOTSTRAP_PASS"
