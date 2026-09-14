# Staging File Scanner Live Activation Runbook

Status: staging-only operational runbook. This document does not authorize production changes.

## Current evidence snapshot

Current candidate at the time of this snapshot: `27ec13ac990d755db0457e2ceabec95462eedc6f`.

Proven on the exact protected Preview:

- Vercel Preview deployment is `READY` for the exact candidate.
- CI run `34144902518` passed, including foundation, TypeScript, lint, build, scanner service tests, scanner Docker build, and Terraform fmt/validate.
- Secret History run `34144902507` passed.
- `Staging Application E2E` run `34144898574` passed, including exact identity, LITE/PRO auth fixtures, sign-in matrix, and fresh-session application E2E.
- exact staging identity passed.
- read-only staging database baseline passed on the immediately preceding scanner-runbook candidate; the current change is documentation-only and application E2E exact identity is current.
- staging scan backlog classifier passed on the current exact candidate with `p=43`, `known=0`, `unknown=43`, `overdue=43`, `unscheduled=0`, `zeroAttempts=43`, `older7d=0`.
- external readiness inventory on the scanner-runbook candidate printed only aggregate/configuration metadata and proved storage ready `4/4` using private Vercel Blob.
- scanner inventory remains not ready `3/12`; the nine missing scanner bindings are listed below.
- guarded stale scanner fixture cleanup passed with `deleted=0`.
- maintenance health is functioning and returns expected aggregate `503` because only `fileScans` is unhealthy: `overduePending=43`; notification delivery, stale uploads, durable file deletion, and AI audit health are healthy.

The first External Readiness attempt on `047fd789e0db93e40023529f3b05b981a8f598c9` briefly received `404` from the maintenance-health route during deployment convergence. A rerun after the exact Preview was stable reached the route correctly and returned the expected aggregate `503` with `fileScans.overduePending=43`. The route was present in the exact Vercel build manifest. This transient first-attempt result is not treated as a code defect.

Current scanner runtime configuration is still missing:

- `IB_FILE_SCANNER_TARGET`
- `IB_FILE_SCANNER_ORIGIN`
- `IB_FILE_SCANNER_SECRET`
- `IB_STAGING_FILE_SCANNER_ORIGIN`
- `IB_STAGING_FILE_SCANNER_SECRET_SHA256`
- `IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY`
- `IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY`
- `IB_STAGING_FILE_SCANNER_CONFIRM`
- `IB_STAGING_VERCEL_BLOB_PRIVATE_HOST`

Therefore the current status remains `LIVE_SCANNER_NOT_PROVEN` until Yandex staging infrastructure, scanner secret, HTTPS origin, and CLEAN/EICAR runtime smoke are actually completed.

## Objective

Prove the complete live malware-scanner chain for the exact `audit/production-readiness` candidate:

`Git SHA -> immutable container image -> isolated staging scanner host -> HTTPS/TLS -> authenticated /health -> CLEAN verdict -> EICAR/MALICIOUS verdict -> application worker -> backlog processing`

Do not mark the scanner `PASS` until every gate below has objective runtime evidence.

## Hard boundaries

- Target environment: `staging` only.
- Repository: `misterio712rino/iburo127`.
- Branch: `audit/production-readiness`.
- PR #1 must remain OPEN, DRAFT, and NOT MERGED.
- Do not use production DNS, production secrets, production database mutation, or production scheduler activation.
- Do not use `latest`; deploy the scanner image by immutable registry digest.
- Do not put scanner secrets in Git, Terraform variables/state, cloud-init, Dockerfile, workflow inputs, shell history, or logs.
- Do not delete, force-READY, or reclassify the existing unknown `PENDING_SCAN` backlog to make health green.

## Gate 0 — exact candidate

Before every mutating operation:

1. Confirm PR #1 is OPEN, DRAFT, NOT MERGED.
2. Confirm PR head is `audit/production-readiness`.
3. Independently read the actual branch HEAD SHA.
4. Require PR head SHA == branch HEAD SHA.
5. Bind image publication, Terraform inputs, smoke verification, and runtime evidence to that exact SHA.

If the branch advances, stop and repeat this gate before continuing.

## Gate 1 — Yandex Cloud inventory

Resolve and review these non-secret values from the staging operator context:

- `cloud_id`
- `folder_id`
- existing staging `network_id`
- zone `ru-central1-d`
- confirmation that `10.132.0.0/28` is free in the reviewed VPC
- staging Container Registry ID
- runtime scanner service-account ID
- publisher service-account ID
- Workload Identity Federation object/configuration used by GitHub Actions

Required IAM intent:

- runtime identity: image pull only, scoped as narrowly as practical to the scanner repository;
- publisher identity: image push only, scoped as narrowly as practical to the scanner repository;
- no static authorized key/JSON key as a substitute for GitHub OIDC.

The federation must restrict GitHub identity to the reviewed issuer/audience/repository/branch boundary documented in `infra/file-scanner-staging/README.md`.

PASS evidence: reviewed IDs and IAM bindings; no production resource referenced.

## Gate 2 — publish immutable scanner image

Use `.github/workflows/staging-file-scanner-image.yml` against the exact candidate SHA.

Inputs:

- exact `candidate_sha`
- staging `registry_id`
- staging `publisher_service_account_id`
- confirmation `PUBLISH_STAGING_FILE_SCANNER_IMAGE_ONLY`

Required evidence from the successful run:

- exact candidate SHA
- repository `cr.yandex/<registry-id>/iburo-file-scanner`
- full-SHA tag
- registry digest matching `sha256:[a-f0-9]{64}`
- immutable image `<repository>@<digest>`
- `STAGING_FILE_SCANNER_IMAGE_PUBLISHED_NOT_DEPLOYED`

Do not continue with a mutable tag alone.

## Gate 3 — Terraform plan

Populate an ignored local `.tfvars` from `infra/file-scanner-staging/terraform.tfvars.example` using only reviewed staging values.

Use the exact toolchain pinned by the module. Run formatting/init/validate and then an authenticated `terraform plan`.

Plan review must prove:

- only the dedicated staging scanner subnet, security group, static IP, and one scanner VM are created/changed by this module;
- no production resource is referenced;
- no default/permissive SG or PostgreSQL SG is attached;
- public ingress is only TCP 80/443;
- public TCP 8080 is absent;
- SSH remains disabled unless separately required and constrained;
- scanner VM uses the reviewed runtime service account;
- scanner image repository + digest match Gate 2;
- no secret is present in plan/state inputs.

Do not apply a plan with unexpected replacement/destruction or unrelated resources.

PASS evidence: reviewed plan tied to exact candidate and immutable image digest.

## Gate 4 — apply staging infrastructure

Apply only the reviewed staging plan.

Expected resources:

- `iburo127-file-scanner-staging-d` subnet;
- dedicated scanner security group;
- deletion-protected staging static IPv4;
- one non-preemptible staging scanner VM.

After apply, verify cloud-init completed and the host has Docker/Caddy preparation from the module. Caddy must remain inactive until DNS/TLS is explicitly configured.

PASS evidence: resource IDs/static IP and successful host preparation, all staging-only.

## Gate 5 — scanner secret bootstrap

Generate a strong staging-only shared scanner secret out of band.

Install only on the scanner host as:

`/etc/iburo-file-scanner/scanner.env`

with owner/mode `root:root 0600` and the documented bounded runtime settings.

Store the matching secret only in the required staging GitHub/Vercel secret scopes. Derive SHA-256 without printing the source secret. Only the fingerprint may be used in non-secret confirmation metadata.

PASS evidence: secret source value was never logged or committed; only its SHA-256 fingerprint is exposed for confirmation.

## Gate 6 — start scanner by immutable digest

Authenticate the host to the private registry using the runtime identity and short-lived credentials only.

Start `services/file-scanner/deploy/docker-compose.staging.yml` using the Terraform-rendered `SCANNER_IMAGE` and `SCANNER_IMAGE_DIGEST` values.

Verify:

- container image digest equals Gate 2;
- binding is `127.0.0.1:8080:8080` only;
- read-only root filesystem;
- no Docker socket;
- no host networking;
- bounded CPU/memory/PID settings;
- ClamAV signature data is present and updateable;
- scanner secret is loaded from the protected host env file.

PASS evidence: running container identity/digest and local health behavior.

## Gate 7 — staging DNS and TLS

Use a staging-only hostname that is not the protected production domain or any prohibited production subdomain.

Point the reviewed staging DNS record to the scanner static IP. Render `services/file-scanner/deploy/Caddyfile.template` with that exact hostname, validate Caddy config, then enable/start Caddy.

Verify externally:

- valid HTTPS certificate;
- only 80/443 are exposed;
- TCP 8080 is not publicly reachable;
- Caddy proxies only to `127.0.0.1:8080`;
- response does not expose server-version details unnecessarily.

PASS evidence: exact HTTPS scanner origin and network exposure proof.

## Gate 8 — authenticated live health

Call the scanner's authenticated `/health` using the staging secret.

Require:

- successful authentication;
- healthy scanner process;
- healthy ClamAV daemon;
- fresh signature age within the configured maximum;
- no secret or provider-internal details in public/error output.

Do not proceed if signatures are stale.

PASS evidence: live `/health` response tied to the reviewed staging origin.

## Gate 9 — branch-scoped application bindings

Configure only the `audit/production-readiness` Preview/staging boundary with the exact scanner values required by readiness/smoke contracts, including:

- scanner target = staging
- exact scanner HTTPS origin
- staging scanner secret
- scanner-secret SHA-256 fingerprint
- exact private Vercel Blob hostname
- CLEAN/MALICIOUS fixture contract values generated by the smoke workflow
- explicit staging confirmation expected by the verifier

Do not copy these values into production scopes.

PASS evidence: external readiness inventory reports scanner prerequisites complete and internally consistent.

## Gate 10 — CLEAN + EICAR/MALICIOUS smoke

Use `.github/workflows/staging-file-scanner-smoke.yml` for the exact candidate SHA only after the exact Preview identity is available.

Inputs:

- exact candidate SHA
- exact staging scanner origin
- exact private Blob hostname
- scanner-secret SHA-256 fingerprint
- confirmation `RUN_STAGING_FILE_SCANNER_SMOKE`

The workflow must prove all of the following:

1. exact protected Preview identity matches the candidate SHA;
2. private Blob hostname preflight matches the reviewed store;
3. inert CLEAN fixture receives `CLEAN`;
4. EICAR fixture receives `MALICIOUS`;
5. no malicious fixture is exposed as READY/downloadable application content;
6. test fixtures are cleaned up exactly as required;
7. no scanner secret is printed.

PASS evidence: successful workflow logs with both expected verdicts.

## Gate 11 — application worker proof

Only after Gate 10 passes, enable the staging scanner E2E/worker boundary required by the application.

Run the file-scan worker against a controlled, bounded batch first. Verify state transitions are correct:

`PENDING_SCAN -> SCANNING -> READY` for clean files

and the configured quarantine/failure outcome for malicious/unscannable files.

Verify download remains possible only for `READY`.

PASS evidence: controlled application-level scan lifecycle, audit trail, and health recovery.

## Gate 12 — existing 43-file backlog

The previously classified backlog is not a technical fixture set: 43 unknown/non-technical `PENDING_SCAN`, 43 overdue, all with zero scan attempts.

Process it only after the live scanner chain is proven. Use bounded worker batches and observe health between batches. Never force status changes merely to clear the metric.

For every processed file, let the normal scanner verdict/state machine decide the outcome. Stop on systemic scanner failures, signature staleness, storage-host mismatch, or unexpected quarantine patterns.

PASS evidence: backlog is reduced by genuine scan attempts/verdicts, not direct database mutation.

## Rollback / fail-closed rules

If any live gate fails:

- disable staging scanner worker/E2E activation;
- keep unproven files non-downloadable;
- do not force `READY`;
- preserve evidence/logs without secrets;
- do not alter production;
- if necessary, stop the staging scanner service while retaining infrastructure for diagnosis;
- destructive infrastructure rollback requires explicit review because the static IP is deletion-protected and Terraform state must remain coherent.

## LIVE_SCANNER_PASS definition

The scanner may be reported as `LIVE_SCANNER_PASS` only when all are true:

- immutable image publication PASS;
- staging infrastructure apply PASS;
- HTTPS/TLS exposure PASS;
- authenticated `/health` PASS with fresh signatures;
- CLEAN runtime verdict PASS;
- EICAR/MALICIOUS runtime verdict PASS;
- private storage boundary PASS;
- exact-SHA Preview identity PASS;
- application worker lifecycle PASS;
- no production resource or production secret was changed.

Anything less remains `LIVE_SCANNER_NOT_PROVEN`.