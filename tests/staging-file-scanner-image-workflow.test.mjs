import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/staging-file-scanner-image.yml";
const workflow = readFileSync(workflowPath, "utf8");
const manifestDigest = `sha256:${"a".repeat(64)}`;
const configDigest = `sha256:${"b".repeat(64)}`;
const tag = "c".repeat(40);

// Exercise the exact awk program embedded in the workflow, not a JS reimplementation.
const awkMatch = workflow.match(/image_digest=.*?awk -v tag="\$\{GITHUB_SHA\}:" '([^']+)'/);
assert.ok(awkMatch, "the push digest must be extracted for the exact candidate tag");
const awkProgram = awkMatch[1];
const { spawnSync } = await import("node:child_process");
const { existsSync } = await import("node:fs");
const windowsAwk = `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Git\\usr\\bin\\awk.exe`;
const awk = process.platform === "win32" && existsSync(windowsAwk) ? windowsAwk : "awk";
function extractPushDigest(output) {
  const result = spawnSync(awk, ["-v", `tag=${tag}:`, awkProgram], {
    input: output, encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.error, undefined, "awk must be available for this workflow contract");
  assert.equal(result.status, 0, result.stderr);
  const digest = result.stdout.trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error("invalid registry push digest");
  return digest;
}
const goodPush = [
  "The push refers to repository [cr.yandex/registry/iburo-file-scanner]",
  "layer-id: Pushed",
  `other-tag: digest: ${configDigest} size: 100`,
  `${tag}: digest: ${manifestDigest} size: 3244`,
].join("\n");
assert.equal(extractPushDigest(goodPush), manifestDigest);
for (const invalid of [
  `other-tag: digest: ${manifestDigest} size: 3244`,
  `${tag}: digest: ${configDigest.toUpperCase()} size: 3244`,
  `${tag}: digest: ${manifestDigest} size: invalid`,
  `${tag}: digest: ${manifestDigest} size: 3244\n${tag}: digest: ${configDigest} size: 3244`,
  `config: digest: ${configDigest} size: 3244`,
]) assert.throws(() => extractPushDigest(invalid), /invalid registry push digest/);

assert.match(workflow, /push_log="\$\(docker push "\$image_tag"\)"/);
assert.doesNotMatch(workflow, /docker buildx imagetools inspect/, "no second digest lookup after a successful push");
assert.match(workflow, /unset [^\n]*push_log image_digest immutable_image/);
assert.match(
  workflow,
  /\[\[ "\$image_digest" =~ \^sha256:\[a-f0-9\]\{64\}\$ \]\]/,
  "the registry digest must remain SHA-256 validated after extraction",
);
assert.match(
  workflow,
  /immutable_image="\$\{image_repository\}@\$\{image_digest\}"/,
  "the image reference must remain immutable",
);
assert.match(
  workflow,
  /test "\$REQUESTED_SHA" = "\$GITHUB_SHA"/,
  "the exact-SHA guard must remain in place",
);
assert.match(
  workflow,
  /test "\$GITHUB_REF" = "refs\/heads\/audit\/production-readiness"/,
  "the staging-only branch guard must remain in place",
);
assert.match(
  workflow,
  /id-token:\s*write/,
  "the OIDC permission must remain in place",
);

const pushPosition = workflow.indexOf('push_log="$(docker push "$image_tag")"');
const pushEvidencePosition = workflow.indexOf('echo "STAGING_FILE_SCANNER_IMAGE_PUSH_CONFIRMED: $GITHUB_SHA"');
const digestPosition = workflow.indexOf('image_digest="$(printf');
assert.ok(pushPosition >= 0 && pushEvidencePosition > pushPosition && digestPosition > pushEvidencePosition,
  "successful registry push must be recorded before strict digest validation");
assert.match(workflow, /name: Authenticate, build, push and verify immutable scanner image/);
console.log("STAGING_FILE_SCANNER_IMAGE_DIGEST_WORKFLOW_TEST_PASS");
