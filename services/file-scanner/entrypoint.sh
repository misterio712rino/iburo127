#!/bin/sh
set -eu

mkdir -p /var/lib/clamav /run/clamav
chown clamav:clamav /var/lib/clamav /run/clamav

signature_bootstrap_ok=0
attempt=1
while [ "$attempt" -le 3 ]; do
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_ATTEMPT:${attempt}"

  if timeout 420s gosu clamav freshclam --stdout --config-file=/etc/clamav/freshclam.conf; then
    signature_bootstrap_ok=1
    break
  fi

  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_RETRY:${attempt}" >&2
  sleep $((attempt * 15))
  attempt=$((attempt + 1))
done

[ "$signature_bootstrap_ok" -eq 1 ] || {
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL" >&2
  exit 1
}

has_signature_database() {
  base="$1"
  [ -s "/var/lib/clamav/${base}.cvd" ] || [ -s "/var/lib/clamav/${base}.cld" ]
}

has_signature_database main || {
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL:main" >&2
  exit 1
}

has_signature_database daily || {
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL:daily" >&2
  exit 1
}

printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_PASS"

gosu clamav clamd --config-file=/etc/clamav/clamd.conf &
clamd_pid=$!
gosu clamav freshclam --stdout --config-file=/etc/clamav/freshclam.conf --daemon &
freshclam_pid=$!
gosu clamav node /service/src/server.mjs &
service_pid=$!

shutdown() {
  kill -TERM "$service_pid" "$freshclam_pid" "$clamd_pid" 2>/dev/null || true
  wait "$service_pid" "$freshclam_pid" "$clamd_pid" 2>/dev/null || true
}

trap shutdown INT TERM EXIT
wait "$service_pid"
