import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const dockerfile = read("services/file-scanner/Dockerfile");
const entrypoint = read("services/file-scanner/entrypoint.sh");
const freshclam = read("services/file-scanner/config/freshclam.conf");
const clamd = read("services/file-scanner/config/clamd.conf");

test("signature bootstrap avoids Docker stdout logfile recursion and restart permission traps", () => {
  assert.doesNotMatch(
    freshclam,
    /^UpdateLogFile\s+\/dev\/(?:stdout|stderr|fd\/\d+)$/m,
    "freshclam must not configure /dev stdout/stderr as a logfile inside the container",
  );
  assert.doesNotMatch(
    clamd,
    /^LogFile\s+\/dev\/(?:stdout|stderr|fd\/\d+)$/m,
    "clamd must not configure /dev stdout/stderr as a logfile because hardened ClamAV rejects those symlink targets",
  );

  assert.match(
    entrypoint,
    /chown clamav:clamav "\$SIGNATURE_DIRECTORY" \/run\/clamav/,
    "bootstrap should transfer ownership of the writable directories without recursively traversing prior clamav-owned signature data",
  );
  assert.doesNotMatch(
    entrypoint,
    /chown\s+-R\s+clamav:clamav\s+(?:"?\$SIGNATURE_DIRECTORY"?|\/var\/lib\/clamav)/,
    "recursive chown is unsafe after capabilities are reduced and the bind mount is already clamav-owned",
  );
  assert.match(entrypoint, /main\.cvd main\.cld/);
  assert.match(entrypoint, /daily\.cvd daily\.cld/);
  assert.match(entrypoint, /bytecode\.cvd bytecode\.cld/);
  assert.match(entrypoint, /freshclam\.dat/);
  assert.match(entrypoint, /chown clamav:clamav "\$candidate"/);

  assert.match(entrypoint, /initial_freshclam_config="\/tmp\/freshclam\.initial\.conf"/);
  assert.match(
    entrypoint,
    /sed '\/\^\[\[:space:\]\]\*NotifyClamd\[\[:space:\]\]\/[d]' \/etc\/clamav\/freshclam\.conf > "\$initial_freshclam_config"/,
    "initial signature download must not try to notify clamd before clamd exists",
  );
  assert.match(
    entrypoint,
    /freshclam\s+--stdout\s+--config-file="\$initial_freshclam_config"/,
  );
  assert.match(
    entrypoint,
    /freshclam\s+--config-file=\/etc\/clamav\/freshclam\.conf\s+--daemon\s+--stdout/,
  );
  assert.match(
    entrypoint,
    /gosu clamav test -s "\$candidate"/,
    "signature readiness must be checked as the clamav runtime user",
  );
});

test("publication can embed a fresh official signature seed without weakening runtime freshness", () => {
  assert.match(
    dockerfile,
    /FROM clamav\/clamav-debian:1\.4\.6_base@sha256:9245cc23e6d080de80bfd2bf0eb84650db0465de1ebcba9fd408e10b65503854 AS runtime/,
  );
  assert.match(dockerfile, /ARG IB_SCANNER_SEED_SIGNATURES=0/);
  assert.match(dockerfile, /DatabaseDirectory \/opt\/clamav-seed/);
  assert.match(dockerfile, /freshclam --stdout --config-file=\/tmp\/freshclam\.seed\.conf/);
  assert.match(dockerfile, /gosu clamav test -s \/opt\/clamav-seed\/main\.cvd/);
  assert.match(dockerfile, /gosu clamav test -s \/opt\/clamav-seed\/daily\.cvd/);

  assert.match(entrypoint, /SIGNATURE_SEED_DIRECTORY="\/opt\/clamav-seed"/);
  assert.match(entrypoint, /signature_set_is_fresh "\$SIGNATURE_SEED_DIRECTORY"/);
  assert.match(entrypoint, /gosu clamav cp -p "\$main_seed" "\$daily_seed" "\$SIGNATURE_DIRECTORY\/" \|\| return 1/);
  assert.match(entrypoint, /gosu clamav cp -p "\$bytecode_seed" "\$SIGNATURE_DIRECTORY\/" \|\| return 1/);
  assert.match(entrypoint, /signature_set_is_fresh "\$SIGNATURE_DIRECTORY" \|\| return 1/);
  assert.doesNotMatch(entrypoint, /^\s*cp -p "\$(?:main_seed|bytecode_seed)"/m);
  assert.match(entrypoint, /gosu clamav stat -c '%Y' "\$daily_path"/, "signature timestamps must be read as clamav since hardened root lacks DAC_OVERRIDE");
  assert.doesNotMatch(entrypoint, /daily_mtime="\$\(stat -c/, "root must not stat the clamav-only signature directory");
  assert.match(entrypoint, /IB_SCANNER_SIGNATURE_MAX_AGE_HOURS:-24/);
  assert.match(entrypoint, /\[ "\$max_age_hours" -ge 1 \] && \[ "\$max_age_hours" -le 168 \]/);
  assert.match(entrypoint, /STAGING_FILE_SCANNER_SIGNATURE_SEED_INSTALLED/);
  assert.match(entrypoint, /STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FRESH_LOCAL_PASS/);
  assert.match(entrypoint, /STAGING_FILE_SCANNER_SIGNATURE_BOOTSTRAP_FAIL:stale/);
  assert.doesNotMatch(entrypoint, /touch .*daily\.(?:cvd|cld)/);
});
