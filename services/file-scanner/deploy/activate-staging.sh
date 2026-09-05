#!/bin/sh
set -eu

umask 077

IMAGE_ENV="/etc/iburo-file-scanner/image.env"
SCANNER_ENV="/etc/iburo-file-scanner/scanner.env"
COMPOSE_FILE="/opt/iburo/file-scanner/docker-compose.staging.yml"
REGISTRY_HOST="cr.yandex"
METADATA_TOKEN_URL="http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"

fail() {
  printf '%s\n' "STAGING_FILE_SCANNER_ACTIVATION_FAIL: $1" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || fail "root required"
[ -f "$IMAGE_ENV" ] || fail "image env missing"
[ -f "$SCANNER_ENV" ] || fail "scanner env missing"
[ -f "$COMPOSE_FILE" ] || fail "compose file missing"
[ "$(stat -c '%U:%G' "$SCANNER_ENV")" = "root:root" ] || fail "scanner env owner invalid"
[ "$(stat -c '%a' "$SCANNER_ENV")" = "600" ] || fail "scanner env mode invalid"

command -v curl >/dev/null 2>&1 || fail "curl unavailable"
command -v jq >/dev/null 2>&1 || fail "jq unavailable"
command -v docker >/dev/null 2>&1 || fail "docker unavailable"
docker compose version >/dev/null 2>&1 || fail "docker compose unavailable"
docker info >/dev/null 2>&1 || fail "docker daemon unavailable"

DOCKER_CONFIG_DIR="$(mktemp -d /run/iburo-scanner-docker-config.XXXXXX)"
export DOCKER_CONFIG="$DOCKER_CONFIG_DIR"
iam_token=""

cleanup() {
  if [ -n "${DOCKER_CONFIG_DIR:-}" ] && [ -d "$DOCKER_CONFIG_DIR" ]; then
    docker logout "$REGISTRY_HOST" >/dev/null 2>&1 || true
    rm -rf "$DOCKER_CONFIG_DIR"
  fi
  unset iam_token DOCKER_CONFIG DOCKER_CONFIG_DIR
}
trap cleanup EXIT HUP INT TERM

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

[ -n "$iam_token" ] || fail "service-account metadata token empty"
printf '%s' "$iam_token" | docker login "$REGISTRY_HOST" --username iam --password-stdin >/dev/null \
  || fail "registry login failed"
unset iam_token

docker compose --env-file "$IMAGE_ENV" -f "$COMPOSE_FILE" config --quiet \
  || fail "compose configuration invalid"
docker compose --env-file "$IMAGE_ENV" -f "$COMPOSE_FILE" pull scanner \
  || fail "immutable scanner image pull failed"

docker logout "$REGISTRY_HOST" >/dev/null 2>&1 || true
rm -rf "$DOCKER_CONFIG_DIR"
unset DOCKER_CONFIG DOCKER_CONFIG_DIR

docker compose --env-file "$IMAGE_ENV" -f "$COMPOSE_FILE" up -d --pull never scanner \
  || fail "scanner container start failed"

printf '%s\n' "STAGING_FILE_SCANNER_CONTAINER_STARTED"
printf '%s\n' "STAGING_FILE_SCANNER_TLS_NOT_ACTIVATED"
