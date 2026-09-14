import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const versions = read("infra/file-scanner-staging/versions.tf");
const providers = read("infra/file-scanner-staging/providers.tf");
const variables = read("infra/file-scanner-staging/variables.tf");
const main = read("infra/file-scanner-staging/main.tf");
const outputs = read("infra/file-scanner-staging/outputs.tf");
const cloudInit = read("infra/file-scanner-staging/cloud-init.yaml.tftpl");
const tfvarsExample = read("infra/file-scanner-staging/terraform.tfvars.example");
const ignore = read("infra/file-scanner-staging/.gitignore");
const readme = read("infra/file-scanner-staging/README.md");
const compose = read("services/file-scanner/deploy/docker-compose.staging.yml");
const caddy = read("services/file-scanner/deploy/Caddyfile.template");
const imageWorkflow = read(".github/workflows/staging-file-scanner-image.yml");
const applicationWorkflow = read(".github/workflows/staging-application-e2e.yml");

assert.match(versions, /required_version\s*=\s*"= 1\.16\.1"/);
assert.match(versions, /source\s*=\s*"yandex-cloud\/yandex"/);
assert.match(versions, /version\s*=\s*"= 0\.223\.0"/);
assert.doesNotMatch(versions, />=\s*0|latest/i);

assert.match(providers, /cloud_id\s*=\s*var\.cloud_id/);
assert.match(providers, /folder_id\s*=\s*var\.folder_id/);
assert.match(providers, /zone\s*=\s*var\.zone/);
assert.doesNotMatch(providers, /token|service_account_key|oauth|secret/i);

for (const name of [
  "cloud_id",
  "folder_id",
  "zone",
  "network_id",
  "runtime_service_account_id",
  "subnet_name",
  "subnet_cidr",
  "vm_name",
  "platform_id",
  "cores",
  "core_fraction",
  "memory_gb",
  "boot_disk_size_gb",
  "boot_disk_type",
  "public_ip_name",
  "security_group_name",
  "ssh_public_key",
  "operator_ssh_cidr",
  "allow_operator_ssh",
  "scanner_image",
  "scanner_image_digest",
  "scanner_hostname",
  "environment",
]) {
  assert.match(variables, new RegExp(`variable "${name}"`), `missing reviewed variable ${name}`);
}
assert.doesNotMatch(variables, /variable\s+"[^"]*(secret|token|credential|password|service_account_key)[^"]*"/i);
const runtimeServiceAccountVariable = variables.match(/variable "runtime_service_account_id"[\s\S]*?(?=\nvariable |$)/)?.[0];
assert.ok(runtimeServiceAccountVariable, "runtime service-account identity must remain an explicit Terraform input");
assert.match(runtimeServiceAccountVariable, /type\s*=\s*string/);
assert.doesNotMatch(runtimeServiceAccountVariable, /default\s*=/);
assert.match(runtimeServiceAccountVariable, /length\(trimspace\(var\.runtime_service_account_id\)\) >= 8/);
assert.match(runtimeServiceAccountVariable, /\[\[:space:\]\[:cntrl:\]\]/);
assert.match(variables, /condition\s*=\s*var\.environment == "staging"/);
assert.match(variables, /!strcontains\(var\.vm_name, "prod"\)/);
assert.match(variables, /strcontains\(var\.scanner_hostname, "staging"\)/);
assert.match(variables, /!strcontains\(var\.scanner_hostname, "prod"\)/);
assert.match(variables, /variable "allow_operator_ssh"[\s\S]*?default\s*=\s*false/);
assert.match(variables, /operator_ssh_cidr[\s\S]*?\/32/);
assert.match(variables, /var\.operator_ssh_cidr != "0\.0\.0\.0\/32"/);
assert.match(variables, /scanner_image_digest[\s\S]*?\^sha256:\[a-f0-9\]\{64\}\$/);
assert.match(variables, /var\.scanner_hostname != "iburo127\.ru"/);
assert.match(variables, /!endswith\(var\.scanner_hostname, "\.iburo127\.ru"\)/);

assert.doesNotMatch(main, /resource\s+"yandex_vpc_network"/);
assert.doesNotMatch(main, /data\s+"yandex_vpc_subnet"/);
assert.match(main, /resource "yandex_vpc_subnet" "scanner"/);
assert.match(main, /network_id\s*=\s*var\.network_id/);
assert.match(main, /zone\s*=\s*var\.zone/);
assert.match(main, /v4_cidr_blocks\s*=\s*\[var\.subnet_cidr\]/);
assert.match(variables, /variable "zone"[\s\S]*?default\s*=\s*"ru-central1-d"/);
assert.match(variables, /variable "subnet_name"[\s\S]*?default\s*=\s*"iburo127-file-scanner-staging-d"/);
assert.match(variables, /variable "subnet_cidr"[\s\S]*?default\s*=\s*"10\.132\.0\.0\/28"/);
assert.match(variables, /var\.subnet_cidr == "10\.132\.0\.0\/28"/);
assert.doesNotMatch(variables, /variable "subnet_id"/);
assert.doesNotMatch(tfvarsExample, /subnet_id/);
assert.match(tfvarsExample, /network_id\s*=\s*"<EXISTING_STAGING_NETWORK_ID>"/);
assert.match(main, /resource "yandex_vpc_security_group" "scanner"/);
assert.match(main, /port\s*=\s*443/);
assert.match(main, /port\s*=\s*80/);
assert.doesNotMatch(main, /port\s*=\s*8080/);
assert.match(main, /for_each\s*=\s*local\.ssh_enabled \? \[var\.operator_ssh_cidr\] : \[\]/);
assert.match(main, /port\s*=\s*22/);
assert.match(main, /local\.ssh_enabled \? \{[\s\S]*?"ssh-keys"/);
assert.match(main, /resource "yandex_vpc_address" "scanner"/);
assert.match(main, /deletion_protection\s*=\s*true/);
assert.match(main, /nat_ip_address\s*=\s*yandex_vpc_address\.scanner\.external_ipv4_address\[0\]\.address/);
assert.match(main, /resource "yandex_compute_instance" "scanner"/);
assert.match(main, /service_account_id\s*=\s*var\.runtime_service_account_id/);
assert.match(main, /subnet_id\s*=\s*yandex_vpc_subnet\.scanner\.id/);
assert.match(main, /security_group_ids\s*=\s*\[yandex_vpc_security_group\.scanner\.id\]/);
assert.doesNotMatch(main, /default-sg|iburo127-postgres-sg|port\s*=\s*6432/i);
assert.doesNotMatch(main, /yandex_vpc_(route_table|gateway)/);
assert.match(main, /preemptible\s*=\s*false/);
assert.match(main, /family\s*=\s*"ubuntu-2404-lts"/);
assert.match(main, /environment\s*=\s*"staging"/);
assert.match(main, /service\s*=\s*"file-scanner"/);
assert.match(main, /repository\s*=\s*"iburo127"/);
assert.doesNotMatch(main, /resource\s+"yandex_(dns_|container_registry|iam_|service_account)/);
for (const deploymentSource of [main, outputs, cloudInit, tfvarsExample, compose, caddy]) {
  assert.doesNotMatch(deploymentSource, /(^|[^.a-z0-9-])(www\.|api\.)?iburo127\.ru([^a-z0-9.-]|$)/i);
}

for (const safeOutput of ["vm_id", "vm_internal_ip", "static_public_ip", "security_group_id", "scanner_subnet_id", "scanner_subnet_cidr", "scanner_hostname"]) {
  assert.match(outputs, new RegExp(`output "${safeOutput}"`));
}
assert.doesNotMatch(outputs, /output\s+"[^"]*(secret|token|credential|environment_file)[^"]*"/i);

assert.match(cloudInit, /\/srv\/iburo-file-scanner\/clamav/);
assert.match(cloudInit, /\/srv\/iburo-file-scanner\/caddy/);
assert.match(cloudInit, /\/etc\/iburo-file-scanner/);
assert.match(cloudInit, /docker\.io/);
assert.match(cloudInit, /docker-compose-v2/);
assert.match(cloudInit, /max-size[\s\S]*10m/);
assert.match(cloudInit, /systemctl, disable, --now, caddy/);
assert.doesNotMatch(cloudInit, /curl[^\n]*\|[^\n]*(sh|bash)|IB_FILE_SCANNER_SECRET|BEGIN [A-Z ]*PRIVATE KEY|token/i);

assert.match(compose, /image: "\$\{SCANNER_IMAGE:\?[^}]+\}@\$\{SCANNER_IMAGE_DIGEST:\?[^}]+\}"/);
assert.match(compose, /127\.0\.0\.1:8080:8080/);
assert.match(compose, /source: \/srv\/iburo-file-scanner\/clamav/);
assert.match(compose, /target: \/var\/lib\/clamav/);
assert.match(compose, /\/etc\/iburo-file-scanner\/scanner\.env/);
assert.match(compose, /no-new-privileges:true/);
assert.match(compose, /restart: unless-stopped/);
assert.match(compose, /read_only:\s*true/);
assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
assert.match(compose, /cap_add:\s*\n\s*- CHOWN\s*\n\s*- SETGID\s*\n\s*- SETUID/);
assert.match(compose, /\/run\/clamav:rw,nosuid,nodev,noexec,size=16m/);
assert.match(compose, /\/tmp:rw,nosuid,nodev,noexec,size=64m/);
const capAddBlock = compose.match(/cap_add:\s*\n((?:\s*- [A-Z0-9_]+\s*\n?)+)/)?.[1];
assert.ok(capAddBlock, "scanner must declare the reviewed startup capability set");
assert.deepEqual(
  [...capAddBlock.matchAll(/- ([A-Z0-9_]+)/g)].map((match) => match[1]),
  ["CHOWN", "SETGID", "SETUID"],
);
assert.doesNotMatch(compose, /privileged:\s*true|network_mode:\s*host|docker\.sock|:latest/i);

assert.match(caddy, /<STAGING_SCANNER_HOSTNAME>/);
assert.match(caddy, /reverse_proxy 127\.0\.0\.1:8080/);
assert.doesNotMatch(caddy, /iburo127\.ru|www\.iburo127\.ru|api\.iburo127\.ru|Authorization|secret/i);

assert.match(imageWorkflow, /^on:\s*\n\s{2}workflow_dispatch:/m);
assert.doesNotMatch(imageWorkflow, /^\s{2}(push|pull_request|schedule):/m);
assert.match(imageWorkflow, /refs\/heads\/audit\/production-readiness/);
for (const input of ["candidate_sha", "registry_id", "publisher_service_account_id", "confirmation"]) {
  assert.match(imageWorkflow, new RegExp(`^\\s{6}${input}:`, "m"));
}
assert.match(imageWorkflow, /PUBLISH_STAGING_FILE_SCANNER_IMAGE_ONLY/);
assert.match(imageWorkflow, /permissions:\s*\n\s+contents: read\s*\n\s+id-token: write/);
assert.match(imageWorkflow, /persist-credentials: false/);
assert.match(imageWorkflow, /ref: \$\{\{ inputs\.candidate_sha \}\}/);
assert.match(imageWorkflow, /test "\$REQUESTED_SHA" = "\$GITHUB_SHA"/);
assert.match(imageWorkflow, /git rev-parse HEAD/);
assert.match(imageWorkflow, /ACTIONS_ID_TOKEN_REQUEST_URL/);
assert.match(imageWorkflow, /ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
assert.match(imageWorkflow, /audience=https%3A%2F%2Fgithub\.com%2Fmisterio712rino/);
assert.match(imageWorkflow, /https:\/\/auth\.yandex\.cloud\/oauth\/token/);
assert.match(imageWorkflow, /grant_type=urn:ietf:params:oauth:grant-type:token-exchange/);
assert.match(imageWorkflow, /requested_token_type=urn:ietf:params:oauth:token-type:access_token/);
assert.match(imageWorkflow, /subject_token_type=urn:ietf:params:oauth:token-type:id_token/);
assert.match(imageWorkflow, /--data-urlencode "audience=\$\{PUBLISHER_SERVICE_ACCOUNT_ID\}"/);
assert.match(imageWorkflow, /--data-urlencode 'subject_token@-'/);
assert.match(imageWorkflow, /jq -er '\.access_token \| strings \| select\(length > 0\)'/);
assert.match(imageWorkflow, /::add-mask::\$iam_token/);
assert.match(imageWorkflow, /cr\.yandex\/\$\{REGISTRY_ID\}\/iburo-file-scanner/);
assert.match(imageWorkflow, /docker build --pull=false --tag "\$image_tag" services\/file-scanner/);
assert.match(imageWorkflow, /docker login cr\.yandex --username iam --password-stdin/);
assert.match(imageWorkflow, /docker push "\$image_tag"/);
assert.match(imageWorkflow, /docker buildx imagetools inspect "\$image_tag" --format '\{\{\.Digest\}\}'/);
assert.match(imageWorkflow, /\^sha256:\[a-f0-9\]\{64\}\$/);
assert.match(imageWorkflow, /STAGING_FILE_SCANNER_IMMUTABLE_IMAGE/);
assert.match(imageWorkflow, /STAGING_FILE_SCANNER_IMAGE_PUBLISHED_NOT_DEPLOYED/);
assert.doesNotMatch(imageWorkflow, /:latest|\b(staging|stable)\b.*tag|docker (login|push).*latest/i);
assert.doesNotMatch(imageWorkflow, /secrets\.|YC_TOKEN|YC_OAUTH_TOKEN|service[_-]?account.*key|authorized[_ -]?key|terraform|kubectl|\byc\s|deployments:\s*write|packages:\s*write|actions:\s*write|contents:\s*write|pull-requests:\s*write|issues:\s*write/i);

assert.match(ignore, /^\.terraform\/$/m);
assert.match(ignore, /^\*\.tfstate$/m);
assert.match(ignore, /^\*\.tfstate\.\*$/m);
assert.match(ignore, /^\*\.tfvars$/m);
assert.match(ignore, /^!terraform\.tfvars\.example$/m);
assert.doesNotMatch(ignore, /^\.terraform\.lock\.hcl$/m);

assert.match(tfvarsExample, /environment\s*=\s*"staging"/);
assert.match(tfvarsExample, /allow_operator_ssh\s*=\s*false/);
assert.match(tfvarsExample, /runtime_service_account_id\s*=\s*"<STAGING_SCANNER_RUNTIME_SERVICE_ACCOUNT_ID>"/);
assert.doesNotMatch(tfvarsExample, /IB_FILE_SCANNER_SECRET|GENERATE_OUT_OF_BAND/);
assert.match(readme, /HOSTNAME REQUIRED — NOT YET ASSIGNED/);
assert.match(readme, /IB_FILE_SCANNER_SECRET=<GENERATE_OUT_OF_BAND>/);
assert.match(readme, /root:root 0600/);
assert.match(readme, /source Git SHA → Docker image → full-SHA tag → registry digest → VM deployment by digest/);
assert.match(readme, /terraform -chdir=infra\/file-scanner-staging init -backend=false/);
assert.match(readme, /10\.132\.0\.0\/28/);
assert.match(readme, /ru-central1-d/);
assert.match(readme, /default network SG must NOT be assigned|default network SG or `iburo127-postgres-sg`/);
assert.match(readme, /TCP 6432/);
assert.match(readme, /runtime_service_account_id/);
assert.match(readme, /container-registry\.images\.puller/);
assert.match(readme, /container-registry\.images\.pusher/);
assert.match(readme, /https:\/\/token\.actions\.githubusercontent\.com/);
assert.match(readme, /https:\/\/github\.com\/misterio712rino/);
assert.match(readme, /repo:misterio712rino\/iburo127:ref:refs\/heads\/audit\/production-readiness/);
assert.match(readme, /IB_STAGING_FILE_SCAN_E2E=0/);

assert.match(applicationWorkflow, /IB_STAGING_FILES_E2E: "1"/);
assert.match(applicationWorkflow, /IB_STAGING_FILE_SCAN_E2E: "0"/);

console.log("FILE_SCANNER_STAGING_INFRASTRUCTURE_CONTRACT_PASS");
