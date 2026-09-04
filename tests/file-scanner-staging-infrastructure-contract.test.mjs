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
  "subnet_id",
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

assert.doesNotMatch(main, /resource\s+"yandex_vpc_(network|subnet)"/);
assert.match(main, /data "yandex_vpc_subnet" "staging"/);
assert.match(main, /data\.yandex_vpc_subnet\.staging\.network_id == var\.network_id/);
assert.match(main, /data\.yandex_vpc_subnet\.staging\.zone == var\.zone/);
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
assert.match(main, /preemptible\s*=\s*false/);
assert.match(main, /family\s*=\s*"ubuntu-2404-lts"/);
assert.match(main, /environment\s*=\s*"staging"/);
assert.match(main, /service\s*=\s*"file-scanner"/);
assert.match(main, /repository\s*=\s*"iburo127"/);
assert.doesNotMatch(main, /yandex_dns_|container_registry|iam_|service_account/);
for (const deploymentSource of [main, outputs, cloudInit, tfvarsExample, compose, caddy]) {
  assert.doesNotMatch(deploymentSource, /(^|[^.a-z0-9-])(www\.|api\.)?iburo127\.ru([^a-z0-9.-]|$)/i);
}

for (const safeOutput of ["vm_id", "vm_internal_ip", "static_public_ip", "security_group_id", "scanner_hostname"]) {
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
assert.doesNotMatch(compose, /privileged:\s*true|network_mode:\s*host|docker\.sock|cap_add:|:latest/i);

assert.match(caddy, /<STAGING_SCANNER_HOSTNAME>/);
assert.match(caddy, /reverse_proxy 127\.0\.0\.1:8080/);
assert.doesNotMatch(caddy, /iburo127\.ru|www\.iburo127\.ru|api\.iburo127\.ru|Authorization|secret/i);

assert.match(imageWorkflow, /^on:\s*\n\s{2}workflow_dispatch:/m);
assert.doesNotMatch(imageWorkflow, /^\s{2}(push|pull_request|schedule):/m);
assert.match(imageWorkflow, /refs\/heads\/audit\/production-readiness/);
assert.match(imageWorkflow, /BUILD_STAGING_FILE_SCANNER_IMAGE_ONLY/);
assert.match(imageWorkflow, /STAGING_FILE_SCANNER_PUBLISH_NOT_CONFIGURED/);
assert.match(imageWorkflow, /docker build --pull=false --tag "\$image" services\/file-scanner/);
assert.doesNotMatch(imageWorkflow, /docker (login|push)|--push|terraform (plan|apply)|kubectl|yc\s/i);
assert.doesNotMatch(imageWorkflow, /secrets\.|contents:\s*write|packages:\s*write/);

assert.match(ignore, /^\.terraform\/$/m);
assert.match(ignore, /^\*\.tfstate$/m);
assert.match(ignore, /^\*\.tfstate\.\*$/m);
assert.match(ignore, /^\*\.tfvars$/m);
assert.match(ignore, /^!terraform\.tfvars\.example$/m);
assert.doesNotMatch(ignore, /^\.terraform\.lock\.hcl$/m);

assert.match(tfvarsExample, /environment\s*=\s*"staging"/);
assert.match(tfvarsExample, /allow_operator_ssh\s*=\s*false/);
assert.doesNotMatch(tfvarsExample, /IB_FILE_SCANNER_SECRET|GENERATE_OUT_OF_BAND/);
assert.match(readme, /HOSTNAME REQUIRED — NOT YET ASSIGNED/);
assert.match(readme, /IB_FILE_SCANNER_SECRET=<GENERATE_OUT_OF_BAND>/);
assert.match(readme, /root:root 0600/);
assert.match(readme, /source Git SHA → Docker image → full-SHA tag → registry digest → VM deployment by digest/);
assert.match(readme, /terraform -chdir=infra\/file-scanner-staging init -backend=false/);

assert.match(applicationWorkflow, /IB_STAGING_FILES_E2E: "1"/);
assert.match(applicationWorkflow, /IB_STAGING_FILE_SCAN_E2E: "0"/);

console.log("FILE_SCANNER_STAGING_INFRASTRUCTURE_CONTRACT_PASS");
