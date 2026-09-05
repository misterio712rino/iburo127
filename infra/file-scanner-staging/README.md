# Staging file-scanner infrastructure

This directory describes only the future isolated **staging** malware-scanner host. It must never target production resources. Nothing here provisions a VPC network, route table, gateway, DNS, IAM identities, a registry, certificates, application data, or secrets.

## Safety boundary

- `environment` is fixed to `staging`.
- Resource names must contain `staging`.
- `network_id` is the mandatory input for the existing reviewed shared VPC. This module never creates a network.
- The module creates one dedicated staging scanner subnet in that supplied network: `iburo127-file-scanner-staging-d` in `ru-central1-d` with the inventory-derived CIDR `10.132.0.0/28`.
- The protected production domain and every subdomain below it are rejected by the hostname validation.
- `scanner_hostname` remains empty until a separately approved staging-only DNS record exists.
- The module does not manage DNS, service accounts, registry repositories, Vercel settings, or application runtime.
- `runtime_service_account_id` is a required externally provisioned staging prerequisite. Its service account must have only `container-registry.images.puller` access scoped as narrowly as the approved scanner repository permits.
- `terraform plan` and `terraform apply` require an authenticated, explicitly reviewed operator context and separate approval. CI only formats and validates with `terraform init -backend=false`.

Do not run Terraform until Yandex Cloud inventory has confirmed the cloud, folder, network, zone, quotas, and ownership of every supplied ID. The dedicated scanner CIDR must remain free in the supplied network.

## Reviewed toolchain

- Terraform CLI: exactly `1.16.1`.
- Yandex Cloud provider: exactly `yandex-cloud/yandex` `0.223.0`.
- No remote backend is configured in this slice.
- No existing Terraform convention was present in the repository. `.terraform.lock.hcl` is intentionally not ignored; generate and review it with `terraform providers lock` once Terraform is available, then commit it in a separate certified change.

## Resources

The module creates only:

1. `iburo127-file-scanner-staging-d`, a dedicated `/28` scanner subnet in the supplied shared VPC.
2. `iburo-file-scanner-staging-sg` (variable-controlled staging name).
3. `iburo-file-scanner-staging-ip`, a deletion-protected static IPv4.
4. `iburo-file-scanner-staging`, a single non-preemptible VM.

Defaults are `standard-v3`, 2 vCPU at 100%, 8 GiB RAM, and a 32 GiB replicated `network-ssd` boot disk. The VM uses the official `ubuntu-2404-lts` image family unless a reviewed immutable `image_id` is supplied.

Subnet separation is not itself a security boundary. The VM explicitly attaches only the dedicated scanner custom SG; do not attach the permissive default network SG or `iburo127-postgres-sg`. The security group exposes only Caddy on TCP 80/443. Port 8080 is never present in the SG, and scanner egress never permits TCP 6432. SSH is absent by default and can only be enabled with both a public key and an explicit non-zero IPv4 `/32`. Egress is protocol/port bounded to DNS, HTTPS, and NTP. A Yandex SG cannot enforce hostname allowlists; independent URL validation, DNS-result rejection, and connection pinning remain authoritative inside the scanner service.

## Host preparation

Cloud-init installs signed Ubuntu repository packages (`docker.io`, `docker-compose-v2`, and `caddy`) rather than executing a remote `curl | sh` installer. It prepares:

- `/srv/iburo-file-scanner/clamav` for persistent signature data;
- `/srv/iburo-file-scanner/caddy` for persistent ACME state;
- `/etc/iburo-file-scanner` for root-owned deployment configuration;
- bounded Docker local logs (10 MiB × 3 files).

Docker is enabled. Caddy is deliberately disabled until an approved hostname and rendered configuration exist. Cloud-init does not pull or run the scanner image and contains no credentials.

## Immutable image identity

The deployment chain is mandatory:

`source Git SHA → Docker image → full-SHA tag → registry digest → VM deployment by digest`

The full-SHA tag is for traceability; the digest is authoritative. Never deploy `latest` or a mutable tag alone. Terraform writes only the non-secret repository and digest to `/etc/iburo-file-scanner/image.env`. The scanner is started later with:

```text
docker compose --env-file /etc/iburo-file-scanner/image.env \
  -f /opt/iburo/file-scanner/docker-compose.staging.yml up -d
```

The compose definition:

- publishes `127.0.0.1:8080:8080` only;
- uses the default isolated bridge network, never host networking;
- mounts no Docker socket;
- is not privileged and adds no capabilities;
- retains the certified root initialization model inside the image, then the entrypoint starts ClamAV and Node as `clamav`;
- persists `/var/lib/clamav` on the host;
- limits the container to 2 vCPU, 6 GiB RAM, and 128 processes.

## Secret bootstrap

No scanner secret or registry credential belongs in Terraform input, state, tfvars, cloud-init, an image, Git, a Dockerfile, a command argument, or workflow logs. The runtime service-account ID is non-secret identity metadata; credentials and authorized keys remain forbidden.

After provisioning and only through an approved out-of-band channel, create:

```text
/etc/iburo-file-scanner/scanner.env
```

Owner and mode:

```text
root:root 0600
```

Content shape:

```text
IB_FILE_SCANNER_SECRET=<GENERATE_OUT_OF_BAND>
IB_SCANNER_MAX_CONCURRENCY=2
IB_SCANNER_SIGNATURE_MAX_AGE_HOURS=24
```

Avoid shell history, Terraform variables/state, cloud-init, Dockerfile `ENV`, Git, and GitHub workflow output. The matching secret later belongs only in the branch-scoped Vercel Preview environment. Derive its SHA-256 fingerprint without printing the source secret; only the digest may be stored in the staging confirmation contract.

## Hostname and TLS

**HOSTNAME REQUIRED — NOT YET ASSIGNED.**

This module creates no DNS resource. Do not use the protected production domain or any of its subdomains. After a separately approved staging-only DNS record points at the static IP:

1. Copy `services/file-scanner/deploy/Caddyfile.template` to `/etc/caddy/Caddyfile`.
2. Replace `<STAGING_SCANNER_HOSTNAME>` with the exact reviewed staging hostname.
3. Validate the Caddy configuration locally on the VM.
4. Enable and start Caddy.
5. Verify that only ports 80/443 are publicly reachable and the scanner remains on loopback.

Caddy terminates public TLS and proxies to `127.0.0.1:8080`. Its certificate state persists under `/srv/iburo-file-scanner/caddy`.

## Inputs and validation workflow

Copy `terraform.tfvars.example` to an ignored local `.tfvars` only after inventory. Replace every placeholder. Do not put credentials or secrets in that file.

Safe local static checks, when the exact Terraform CLI is available:

```text
terraform -chdir=infra/file-scanner-staging fmt -check
terraform -chdir=infra/file-scanner-staging init -backend=false
terraform -chdir=infra/file-scanner-staging validate
```

These commands download the pinned provider but do not contact Yandex Cloud resources. Live planning and provisioning remain separate, explicitly authorized operations.

## Controlled image workflow

`.github/workflows/staging-file-scanner-image.yml` is `workflow_dispatch`-only and restricted to `audit/production-readiness`. It may publish only the exact checked-out candidate SHA to `cr.yandex/<registry-id>/iburo-file-scanner:<full-sha>`, then reports the registry-derived immutable digest. It never deploys the VM, runs Terraform, changes DNS, changes Vercel, or enables scanner E2E.

Publication requires separately provisioned staging prerequisites: a scanner registry; the runtime puller service account `iburo-file-scanner-staging-runtime`; the publisher service account `iburo-file-scanner-staging-publisher` with only `container-registry.images.pusher` access scoped as narrowly as practical; and Yandex Workload Identity Federation. The federation must accept only GitHub Actions issuer `https://token.actions.githubusercontent.com`, audience `https://github.com/misterio712rino`, and subject `repo:misterio712rino/iburo127:ref:refs/heads/audit/production-readiness`. No authorized key, JSON key, static credential, or GitHub secret may replace this OIDC exchange.

The scanner image is deployed only by immutable repository digest; never use `latest` or another mutable tag. A successful publication ends at `STAGING_FILE_SCANNER_IMAGE_PUBLISHED_NOT_DEPLOYED`.

## Activation boundary

Infrastructure readiness does not prove scanner readiness. Keep application scanner E2E disabled until all of the following pass:

1. Private image publication and digest verification.
2. Authenticated scanner `/health` with fresh ClamAV signatures.
3. Provider-aware CLEAN/MALICIOUS smoke and exact fixture cleanup.
4. Branch-scoped Preview origin, secret, fingerprint, and confirmation review.
5. Explicit approval to enable the scanner E2E flag.

Phase 2 private-file E2E remains enabled; `IB_STAGING_FILE_SCAN_E2E=0` remains unchanged until the live scanner smoke passes.
