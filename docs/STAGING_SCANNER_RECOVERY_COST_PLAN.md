# Staging scanner: cost-capped recovery decision (2026-09-20)

Status: **PLAN ONLY / NO RECOVERY AUTHORIZATION / PRODUCTION BLOCKED**. This document must not be interpreted as permission to create, start, stop, delete, or modify cloud resources, credentials, IAM, SSH, Security Groups, DNS, client data, or scanner services. No Terraform apply. PR #1 stays open, draft, and unmerged.

## Grounded evidence

Owner's Yandex Cloud console screenshots, 2026-09-20:

- Original isolated scanner VM: `iburo-file-scanner-staging`, ID `fv4djim5ldgphr78lt0h`, owner-observed **STOPPED**. Preserve this original VM; do not delete it. Its boot disk has `auto_delete=true` in the reviewed Terraform configuration, making VM deletion particularly hazardous.
- Original 32 GiB SSD boot disk: `fv4dnod528dsrsuope7s`, source disk marked READY before snapshot, approximate console display **458.50 RUB/month** for this existing disk.
- Snapshot: `fd8hgjh5em0hb6ptianq`, owner-observed **READY**; displayed 4.17 GiB and **15.32 RUB/month**. Taken from the correct disk creation flow, though the snapshot detail screenshot did not show a dedicated source_disk_id field. Restoration has **NOT** been tested.
- The last guest-service status is **UNVERIFIED**. Prior public `/health` was unreachable. RUNNING/STOPPED says nothing about Docker, Caddy, ClamAV, or scanner functionality. There are 43 actual unknown/nontechnical records in `PENDING_SCAN`; do not process, clean, delete, or reclassify them without separate permission.
- Password of original Ubuntu guest is unknown. Original VM serial console is disabled; original Security Group does not expose TCP/22. User has expressly forbidden an SSH/TCP-22 reintroduction or SG change. Original VM metadata contains `user-data`; do not read or overwrite it for this investigation.

## Tariff model and upper-bound inputs (estimate, not an invoice)

Official references:

- [Compute Cloud pricing](https://yandex.cloud/ru/docs/compute/pricing): VM billed from RUNNING to completely STOPPED; disks billed regardless of state; snapshots billed separately; new VM starts automatically on creation. Illustrative published Russian rates for Intel Ice Lake: 100%-performance vCPU **1.24 RUB/vCPU-hour** and memory **0.33 RUB/GiB-hour**. Rates and contractual billing must be reconfirmed in the owner's console before purchase; these are **not guaranteed account-specific rates**.
- [VPC pricing](https://yandex.cloud/ru/docs/vpc/pricing): an inactive reserved public IP is **0.6039 RUB/hour** in the published Russian example (0.26352 address + 0.34038 reservation). Check the exact actual billing row before treating this as your bill.
- [Recovery of VM access](https://yandex.cloud/ru/docs/compute/operations/vm-connect/recovery-access): snapshot-to-new-VM method; serial console needs a Linux user password; snapshot-to-auxiliary-VM-and-disk method is a fallback; altered cloud-init may invalidate straightforward credential reset.
- [Create VM from snapshot](https://yandex.cloud/ru/docs/compute/operations/vm-create/create-from-snapshots): this creates a distinct boot disk and VM; it does not modify the original or snapshot. A new VM starts upon creation and incurs cost immediately.

Illustrative same-size restoration compute: 2 vCPU at 100% + 8 GiB RAM = **2 × 1.24 + 8 × 0.33 = 5.12 RUB per RUNNING hour** before disk, IP, traffic and other services. A new 32 GiB SSD incurs separate charges even when its VM is off; the original disk's console quote of 458.50 RUB/month is only a same-spec spending reference, NOT an approved quote for a new disk. A new dynamic public IP, if assigned, and other services may add expense. The existing static IP remains billed while the original VM is stopped. Do not accidentally allocate a second static IP or duplicate pre-existing paid infrastructure.

**Cost-control gate:** Before any future creation, obtain an exact new-VM form estimate or current applicable price list and set an explicit maximum cash budget, RUNNING time window, disk/VM lifecycle and cleanup approval. A time window alone cannot cap charges for disks left behind. There is no automatic deletion approved. Retain the existing snapshot and original VM unless separate written authorization explicitly changes this.

## Access-path feasibility: BLOCKED pending design and authorization

- **Do not assume** creating a new VM from the snapshot fixes guest login. The documented default uses new SSH credentials; this project explicitly prohibits SSH and Security Group TCP/22 changes. OS Login at the provider/serial gateway is not proof of successful Linux guest login. The original guest's local password is unknown. A clone may retain historical cloud-init identity/configuration and fail to consume new access metadata.
- Do not inject a plaintext password into `user-data` or logs, duplicate confidential VM metadata, expose new VM publicly, or activate the original app/scanner merely for access recovery.
- An auxiliary VM plus a new disk from snapshot would add *two* billable disk footprints (helper boot disk and restored disk) and requires a specifically authorized secure guest access channel. It is a fallback, **not a zero-cost solution**. No SSH access route is presently approved.
- If a reviewed password-free, non-SSH method cannot be established that respects the owner's restrictions, explicitly report **ACCESS PATH BLOCKED** instead of provisioning first and discovering the blockage later.

## Exact next gate (no further audit loop)

1. Without querying the Yandex account again, develop **one** feasible non-SSH access procedure for a temporary isolated VM based only on published Yandex documentation and existing approved IAM. It must specify Linux guest authentication, exposure boundary, exact non-secret metadata behavior, rollback, and how the initial snapshot remains untouched. If none is feasible, STOP and ask for a narrowly scoped exception rather than inventing one.
2. Present owner with a single transaction: intended temporary VM/disk(s), current account-specific price or visibly labeled estimate, upper budget, automatic start behavior, expected runtime, ongoing storage cost, access method, disposal/retention plan and failure response. Obtain separate permission for resources and any login/config changes. No permission is inferred from this document.
3. Only after authorization, execute once with separate verification; no repetitions and no SSH/SG/user-data changes unless individually authorized. Validate the recovered guest and scanner only in the allowed environment; actual file processing requires a different approval.

**Current decision:** retain snapshot READY and original VM STOPPED. Do not provision an auxiliary VM or clone until secure non-SSH access and an owner-approved cost cap are defined. This is a finite decision checkpoint, not an instruction to keep running cloud audits.
