#!/bin/sh
set -eu

SIGNATURE_DIRECTORY="/var/lib/clamav"
SIGNATURE_SEED_DIRECTORY="/opt/clamav-seed"

mkdir -p "$SIGNATURE_DIRECTORY" /run/clamav
chown clamav:clamav "$SIGNATURE_DIRECTORY" /run/clamav

signature_file_path() {
  directory="$1"
  base="$2"
  for extension in cvd cld; do
    candidate="${directory}/${base}.${extension}"
    if gosu clamav test -s "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

signature_set_is_fresh() {
  directory="$1"
  main_path="$(signature_file_path "$directory" main)" || return 1
  daily_path="$(signature_file_path "$directory" daily)" || return 1
  test -n "$main_path"

  max_age_hours="${IB_SCANNER_SIGNATURE_MAX_AGE_HOURS:-24}"
  case "$max_age_hours" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$max_age_hours" -ge 1 ] && [ "$max_age_hours" -le 168 ] || return 1

  daily_mtime="$(stat -c '%Y' "$daily_path")" || return 1
  now="$(date +%s)"
  [ "$daily_mtime" -le "$now" ] || return 1
  [ $((now - daily_mtime)) -le $((max_age_hours * 3600)) ] || return 1
}

install_fresh_seed_if_available() {
  [ -d "$SIGNATURE_SEED_DIRECTORY" ] || return 1
  signature_set_is_fresh "$SIGNATURE_SEED_DIRECTORY" || return 1

  main_seed="$(signature_file_path "$SIGNATURE_SEED_DIRECTORY" main)" || return 1
  daily_seed="$(signature_file_path "$SIGNATURE_SEED_DIRECTORY" daily)" || return 1

  cp -p "$main_seed" "$daily_seed" "$SIGNATURE_DIRECTORY/"
  if bytecode_seed="$(signature_file_path "$SIGNATURE_SEED_DIRECTORY" bytecode 2>/dev/null)"; then
    cp -p "$bytecode_seed" "$SIGNATURE_DIRECTORY/"
  fi
  chown clamav:clamav "$SIGNATURE_DIRECTORY"/*.cvd "$SIGNATURE_DIRECTORY"/*.cld 2>/dev/null || true
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_SEED_INSTALLED"
}

if ! signature_set_is_fresh "$SIGNATURE_DIRECTORY"; then
  install_fresh_seed_if_available || true
fi

initial_freshclam_config="/tmp/freshclam.initial.conf"
sed '/^[[:space:]]*NotifyClamd[[:space:]]/d' /etc/clamav/freshclam.conf > "$initial_freshclam_config"
chmod 0644 "$initial_freshclam_config"

if signature_set_is_fresh "$SIGNATURE_DIRECTORY"; then
  signature_bootstrap_ok=1
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FRESH_LOCAL_PASS"
else
  signature_bootstrap_ok=0
  attempt=1
  while [ "$attempt" -le 3 ]; do
    printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_ATTEMPT:${attempt}"

    if timeout 420s gosu clamav freshclam --stdout --config-file="$initial_freshclam_config"; then
      signature_bootstrap_ok=1
      break
    fi

    printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_RETRY:${attempt}" >&2
    sleep $((attempt * 15))
    attempt=$((attempt + 1))
  done
fi

rm -f "$initial_freshclam_config"

[ "$signature_bootstrap_ok" -eq 1 ] || {
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL" >&2
  exit 1
}

signature_file_path "$SIGNATURE_DIRECTORY" main >/dev/null || {
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL:main" >&2
  exit 1
}

signature_file_path "$SIGNATURE_DIRECTORY" daily >/dev/null || {
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL:daily" >&2
  exit 1
}

signature_set_is_fresh "$SIGNATURE_DIRECTORY" || {
  printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL:stale" >&2
  exit 1
}

printf '%s\n' "STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_PASS"

gosu clamav clamd --config-file=/etc/clamav/clamd.conf &
clamd_pid=$!
gosu clamav freshclam --config-file=/etc/clamav/freshclam.conf --daemon --stdout &
freshclam_pid=$!
gosu clamav node /service/src/server.mjs &
service_pid=$!

shutdown() {
  kill -TERM "$service_pid" "$freshclam_pid" "$clamd_pid" 2>/dev/null || true
  wait "$service_pid" "$freshclam_pid" "$clamd_pid" 2>/dev/null || true
}

trap shutdown INT TERM EXIT
wait "$service_pid"
