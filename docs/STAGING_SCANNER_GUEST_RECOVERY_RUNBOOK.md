# Staging scanner guest-access recovery runbook

Status: **PREPARATION ONLY — no current execution authorization**. This runbook
is for the existing staging scanner VM only. It does not authorize a VM start,
disk/snapshot/VM creation, an attachment, SSH ingress, metadata or IAM changes,
Terraform, scanner activation, or access to customer objects.

## Confirmed boundary

- Source VM: `fv4djim5ldgphr78lt0h` (`iburo-file-scanner-staging`).
- Source boot disk: `fv4dnod528dsrsuope7s`.
- Preservation snapshot: `fd8hgjh5em0hb6ptianq`.
- Folder: `b1ggvchbjvrt2b5rju0g`; intended zone: `ru-central1-d`.
- The source VM was last independently observed **STOPPED**, its disk and the
  snapshot **READY**, and source security group ingress has no TCP/22. Recheck
  all of this before any future action.

These facts do **not** prove current guest health, Docker/Caddy state, a valid
SSH host key, a working OS Login agent, or absence of a prior `iburorescue`
account.

## What the old SSH result proves

`Permission denied (publickey)` after the client offered the expected ED25519
public key proves only that `sshd` rejected that authentication attempt. It
does not distinguish an OS Login profile/role/certificate problem from a guest
OS Login agent, NSS, PAM, `sshd`, `AuthorizedKeysCommand`, username, or local
account configuration problem. It also says nothing about server identity:
server host-key verification is a separate prerequisite and must be completed
before accepting any future network SSH connection.

The minimum offline evidence needed to distinguish these cases is limited to
file names, ownership/mode, package/service status and sanitized configuration
directives from: OS Login agent configuration and logs; `/etc/nsswitch.conf`;
PAM SSH stack; `sshd -T` output and included sshd configuration; cloud-init
status/log metadata; and local account enumeration sufficient to answer whether
`iburorescue` exists. Do not collect secret files, private keys, `user-data`,
scanner `.env` files, Docker environment, application logs, or customer data.

## Read-only gate

Run the local preflight **before requesting any cloud mutation**, substituting
the actual helper VM ID only after an owner has approved a helper VM:

```text
node scripts/check-file-scanner-snapshot-recovery-preflight.mjs \
  --yc <approved-yc-path> --folder-id b1ggvchbjvrt2b5rju0g \
  --source-vm-id fv4djim5ldgphr78lt0h \
  --source-disk-id fv4dnod528dsrsuope7s \
  --snapshot-id fd8hgjh5em0hb6ptianq \
  --helper-vm-id <approved-helper-id> --zone ru-central1-d
```

The script issues only four `yc ... get --format json` calls. It fails closed
unless source VM/disk/snapshot/helper IDs, folder, zone, expected stopped/ready
states, snapshot source disk, source-disk attachment and absence of the
**original** disk on the helper all agree. It does not create, start, stop,
attach, mount, detach, update, or delete anything, and deliberately never
prints child-process stderr.

## Future authorized offline inspection (not a command to execute now)

1. Obtain a new written authorization with a price ceiling, helper VM/disk
   lifecycle, maximum running time, nominated operator, and independently
   verified teardown. Confirm account billing/quota and no competing operations.
2. Retain the source VM, source disk and preservation snapshot unchanged. Create
   a **new copy disk from the snapshot**, never from the original disk. Use an
   auxiliary VM in `ru-central1-d` with a boot image different from the source
   image; Yandex warns that matching filesystem UUIDs can cause the helper to
   boot from the attached recovery disk.
3. Preflight the resource IDs with the script above while the helper is stopped.
   The original disk must not be attached to it. A successful CLI attachment is
   not evidence of read-only mode.
4. Request an API attachment with `mode=READ_ONLY` and a unique device name;
   the Compute API documents `READ_ONLY` and `READ_WRITE` modes. After the
   operation completes, verify the returned attachment mode via API before the
   helper is started. If mode is absent, ambiguous, or `READ_WRITE`, stop:
   do not mount or inspect the copy. The prior `READ_ONLY` REST HTTP 400 had no
   retained body, so it must not be retried as if its cause were known.
5. On the helper, identify the copy by the assigned device name under
   `/dev/disk/by-id`, not filesystem UUID. Do not boot it and do not allow an
   automounter to mount it. For ext filesystems mount only with `-o ro,noload`
   to avoid journal replay; use the filesystem-specific no-recovery option for
   another filesystem. Confirm the mount is read-only before collecting the
   limited diagnostic evidence listed above.
6. Preserve sanitized evidence and independently obtain the source VM SSH host
   public key/fingerprint from a trusted cloud-side source before any SSH test.
   Do not use `ssh-keyscan` as the independent source. Compare it exactly with
   a later network result and use a fresh dedicated `known_hosts` file with
   `StrictHostKeyChecking=yes`.
7. Stop after diagnosis. Any repair needs a second explicit authorization, a
   new rollback snapshot of the copy disk, a reviewed diff of the exact files,
   and a plan that does not reset cloud-init or alter the original disk.
8. After an authorized inspection, unmount, verify no copy disk remains
   attached, stop and delete **only** approved temporary resources, and retain
   the original VM/disk/snapshot. Re-inventory IDs, states, security group and
   billing. Failure to confirm teardown is a blocking incident, not a reason to
   continue with scanner activation.

Yandex documents the snapshot-to-auxiliary-VM approach for failed SSH recovery,
the need for a different helper image to avoid UUID boot conflicts, and the
availability of `READ_ONLY` disk attachment mode. It also documents Ubuntu
24.04 public images as including the OS Login agent; that removes one install
prerequisite but does not prove the already-created guest accepts a login.

References: [recovery access](https://yandex.cloud/en/docs/compute/operations/vm-connect/recovery-access),
[disk attachment](https://yandex.cloud/en/docs/compute/api-ref/Instance/attachDisk),
[existing-VM OS Login](https://yandex.cloud/en/docs/compute/operations/vm-connect/enable-os-login),
and [OS Login concepts](https://yandex.cloud/en/docs/organization/concepts/os-login).

## Explicitly excluded

This procedure does not activate Docker, Caddy, ClamAV or workers; read any
scanner secrets; access the 43 PENDING_SCAN objects; repair the source VM;
change production; or establish that the scanner is live. Those are separate
gates after successful, authenticated guest access and fresh authorization.
