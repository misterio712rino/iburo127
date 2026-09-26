#!/bin/sh
set -eu

umask 077

CERTIFICATE_ID="fpqg6c69vqs7khjkhcmt"
SCANNER_HOSTNAME="scanner-v2-staging.iburo127.online"
CERTIFICATE_API="https://data.certificate-manager.api.cloud.yandex.net/certificate-manager/v1/certificates"
METADATA_TOKEN_URL="http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"
CERT_FILE="/srv/iburo-file-scanner/caddy/certs/chain.pem"
KEY_FILE="/srv/iburo-file-scanner/caddy/certs/key.pem"
CADDYFILE="/etc/caddy/Caddyfile"
RENEW_WINDOW_DAYS="${IB_TLS_RENEW_WINDOW_DAYS:-45}"
MIN_VALID_DAYS="${IB_TLS_MIN_VALID_DAYS:-30}"
FORCE_CHECK="${IB_TLS_RENEW_FORCE_CHECK:-0}"

fail() {
  printf '%s\n' "STAGING_TLS_RENEW_FAIL:$1" >&2
  exit 1
}

require_uint() {
  case "$2" in ''|*[!0-9]*) fail "invalid-$1" ;; esac
}

[ "$(id -u)" -eq 0 ] || fail "root-required"
require_uint "renew-window-days" "$RENEW_WINDOW_DAYS"
require_uint "min-valid-days" "$MIN_VALID_DAYS"
[ "$RENEW_WINDOW_DAYS" -gt "$MIN_VALID_DAYS" ] || fail "invalid-renew-window"
[ "$MIN_VALID_DAYS" -ge 7 ] || fail "invalid-min-valid-days"
[ "$FORCE_CHECK" = "0" ] || [ "$FORCE_CHECK" = "1" ] || fail "invalid-force-check"

for command in curl jq openssl sha256sum date install mktemp stat caddy systemctl; do
  command -v "$command" >/dev/null 2>&1 || fail "missing-$command"
done

[ -f "$CERT_FILE" ] || fail "installed-cert-missing"
[ -f "$KEY_FILE" ] || fail "installed-key-missing"
[ "$(stat -c '%U:%G' "$CERT_FILE")" = "root:caddy" ] || fail "installed-cert-owner"
[ "$(stat -c '%a' "$CERT_FILE")" = "644" ] || fail "installed-cert-mode"
[ "$(stat -c '%U:%G' "$KEY_FILE")" = "root:caddy" ] || fail "installed-key-owner"
[ "$(stat -c '%a' "$KEY_FILE")" = "640" ] || fail "installed-key-mode"

now_epoch="$(date +%s)"
installed_end_text="$(openssl x509 -in "$CERT_FILE" -noout -enddate | sed 's/^notAfter=//')" || fail "installed-cert-invalid"
installed_end_epoch="$(date -u -d "$installed_end_text" +%s)" || fail "installed-expiry-invalid"
installed_remaining_days=$(( (installed_end_epoch - now_epoch) / 86400 ))
[ "$installed_remaining_days" -gt 0 ] || fail "installed-cert-expired"

if [ "$FORCE_CHECK" = "0" ] && [ "$installed_remaining_days" -gt "$RENEW_WINDOW_DAYS" ]; then
  printf '%s\n' "STAGING_TLS_RENEW_NOT_DUE remaining_days=$installed_remaining_days"
  exit 0
fi

work_dir="$(mktemp -d /run/iburo-staging-tls-renew.XXXXXX)"
chmod 0700 "$work_dir"
auth_header="$work_dir/auth.header"
payload_file="$work_dir/payload.json"
candidate_chain="$work_dir/chain.pem"
candidate_key="$work_dir/key.pem"
backup_chain="$work_dir/previous-chain.pem"
backup_key="$work_dir/previous-key.pem"
next_chain="${CERT_FILE}.next.$$"
next_key="${KEY_FILE}.next.$$"

cleanup() {
  rm -f "$next_chain" "$next_key"
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM HUP

iam_token="$(
  curl --silent --show-error --fail \
    --connect-timeout 2 --max-time 8 \
    --header 'Metadata-Flavor:Google' \
    "$METADATA_TOKEN_URL" \
  | jq -er '.access_token | strings | select(length > 100)'
)" || fail "metadata-token-unavailable"

printf 'Authorization: Bearer %s\n' "$iam_token" > "$auth_header"
chmod 0600 "$auth_header"
unset iam_token

curl --silent --show-error --fail \
  --connect-timeout 3 --max-time 20 \
  --header "@$auth_header" \
  --output "$payload_file" \
  "${CERTIFICATE_API}/${CERTIFICATE_ID}:getContent" \
  || fail "certificate-content-unavailable"

rm -f "$auth_header"

jq -er --arg id "$CERTIFICATE_ID" '
  select(.certificateId == $id)
  | .certificateChain
  | arrays
  | select(length >= 1 and length <= 10)
  | .[]
  | strings
  | select(startswith("-----BEGIN CERTIFICATE-----"))
' "$payload_file" > "$candidate_chain" || fail "candidate-chain-invalid"

jq -er '
  .privateKey
  | strings
  | select(startswith("-----BEGIN ") and contains("PRIVATE KEY-----"))
' "$payload_file" > "$candidate_key" || fail "candidate-key-invalid"

rm -f "$payload_file"
chmod 0600 "$candidate_chain" "$candidate_key"

openssl x509 -in "$candidate_chain" -noout >/dev/null 2>&1 || fail "candidate-cert-parse"
openssl pkey -in "$candidate_key" -noout >/dev/null 2>&1 || fail "candidate-key-parse"
openssl x509 -in "$candidate_chain" -checkhost "$SCANNER_HOSTNAME" -noout >/dev/null 2>&1 || fail "candidate-hostname"

candidate_start_text="$(openssl x509 -in "$candidate_chain" -noout -startdate | sed 's/^notBefore=//')" || fail "candidate-start-invalid"
candidate_end_text="$(openssl x509 -in "$candidate_chain" -noout -enddate | sed 's/^notAfter=//')" || fail "candidate-expiry-invalid"
candidate_start_epoch="$(date -u -d "$candidate_start_text" +%s)" || fail "candidate-start-invalid"
candidate_end_epoch="$(date -u -d "$candidate_end_text" +%s)" || fail "candidate-expiry-invalid"

[ "$candidate_start_epoch" -le $((now_epoch + 300)) ] || fail "candidate-not-yet-valid"
[ $((candidate_end_epoch - now_epoch)) -gt $((MIN_VALID_DAYS * 86400)) ] || fail "candidate-insufficient-lifetime"

candidate_cert_pub="$(
  openssl x509 -in "$candidate_chain" -pubkey -noout \
  | openssl pkey -pubin -outform DER 2>/dev/null \
  | sha256sum | awk '{print $1}'
)" || fail "candidate-cert-public-key"
candidate_key_pub="$(
  openssl pkey -in "$candidate_key" -pubout -outform DER 2>/dev/null \
  | sha256sum | awk '{print $1}'
)" || fail "candidate-key-public-key"
[ "$candidate_cert_pub" = "$candidate_key_pub" ] || fail "candidate-key-mismatch"
unset candidate_cert_pub candidate_key_pub

installed_fp="$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha256 | sed 's/^sha256 Fingerprint=//;s/^SHA256 Fingerprint=//')" || fail "installed-fingerprint"
candidate_fp="$(openssl x509 -in "$candidate_chain" -noout -fingerprint -sha256 | sed 's/^sha256 Fingerprint=//;s/^SHA256 Fingerprint=//')" || fail "candidate-fingerprint"

if [ "$candidate_fp" = "$installed_fp" ]; then
  printf '%s\n' "STAGING_TLS_RENEW_NOOP current_certificate=true remaining_days=$installed_remaining_days"
  exit 0
fi

[ "$candidate_end_epoch" -gt "$installed_end_epoch" ] || fail "candidate-not-newer"

cp -p "$CERT_FILE" "$backup_chain"
cp -p "$KEY_FILE" "$backup_key"

install -o root -g caddy -m 0644 "$candidate_chain" "$next_chain"
install -o root -g caddy -m 0640 "$candidate_key" "$next_key"

mv -f "$next_key" "$KEY_FILE"
mv -f "$next_chain" "$CERT_FILE"

rollback() {
  install -o root -g caddy -m 0644 "$backup_chain" "$CERT_FILE"
  install -o root -g caddy -m 0640 "$backup_key" "$KEY_FILE"
  caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1 || true
  systemctl reload caddy >/dev/null 2>&1 || true
}

if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null; then
  rollback
  fail "caddy-validation-after-install"
fi

if ! systemctl reload caddy >/dev/null; then
  rollback
  fail "caddy-reload"
fi

health_status="$(
  curl --silent --show-error \
    --connect-timeout 3 --max-time 12 \
    --resolve "${SCANNER_HOSTNAME}:443:127.0.0.1" \
    --output /dev/null --write-out '%{http_code}' \
    "https://${SCANNER_HOSTNAME}/health" \
    || true
)"

if [ "$health_status" != "401" ]; then
  rollback
  fail "post-reload-https"
fi

new_remaining_days=$(( (candidate_end_epoch - now_epoch) / 86400 ))
printf '%s\n' "STAGING_TLS_RENEW_PASS remaining_days=$new_remaining_days"
