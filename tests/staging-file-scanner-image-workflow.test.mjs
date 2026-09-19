import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/staging-file-scanner-image.yml";
const workflow = readFileSync(workflowPath, "utf8");

assert.match(
  workflow,
  /docker buildx imagetools inspect "\$image_tag" --format '\{\{\.Manifest\.Digest\}\}'/,
  "digest extraction must read the registry manifest descriptor, not a nonexistent tplInput field",
);
assert.doesNotMatch(
  workflow,
  /--format '\{\{\.Digest\}\}'/,
  "the unsupported top-level imagetools Digest field must not return",
);
assert.match(
  workflow,
  /\[\[ "\$image_digest" =~ \^sha256:\[a-f0-9\]\{64\}\$ \]\]/,
  "the registry digest must remain SHA-256 validated",
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

console.log("STAGING_FILE_SCANNER_IMAGE_DIGEST_WORKFLOW_TEST_PASS");
