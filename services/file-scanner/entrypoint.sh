#!/bin/sh
set -eu

mkdir -p /var/lib/clamav /run/clamav
chown -R clamav:clamav /var/lib/clamav /run/clamav

timeout 120s gosu clamav freshclam --config-file=/etc/clamav/freshclam.conf || true

gosu clamav clamd --config-file=/etc/clamav/clamd.conf &
clamd_pid=$!
gosu clamav freshclam --config-file=/etc/clamav/freshclam.conf --daemon &
freshclam_pid=$!
gosu clamav node /service/src/server.mjs &
service_pid=$!

shutdown() {
  kill -TERM "$service_pid" "$freshclam_pid" "$clamd_pid" 2>/dev/null || true
  wait "$service_pid" "$freshclam_pid" "$clamd_pid" 2>/dev/null || true
}

trap shutdown INT TERM EXIT
wait "$service_pid"
