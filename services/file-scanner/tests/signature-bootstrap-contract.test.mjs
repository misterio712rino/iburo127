import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

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
    /chown clamav:clamav \/var\/lib\/clamav \/run\/clamav/,
    "bootstrap should transfer ownership of the writable directories without recursively traversing prior clamav-owned signature data",
  );
  assert.doesNotMatch(
    entrypoint,
    /chown\s+-R\s+clamav:clamav\s+\/var\/lib\/clamav/,
    "recursive chown is unsafe after capabilities are reduced and the bind mount is already clamav-owned",
  );

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
    /gosu clamav test -s "\/var\/lib\/clamav\/\$\{base\}\.cvd"/,
    "signature readiness must be checked as the clamav runtime user after the bind mount is transferred to clamav ownership",
  );
  assert.match(
    entrypoint,
    /gosu clamav test -s "\/var\/lib\/clamav\/\$\{base\}\.cld"/,
    "signature readiness must accept cld databases as the clamav runtime user",
  );
});
