import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/staging-file-scanner-image.yml";
const workflow = readFileSync(workflowPath, "utf8");
const manifestDigest = `sha256:${"a".repeat(64)}`;
const configDigest = `sha256:${"b".repeat(64)}`;
const layerDigest = `sha256:${"c".repeat(64)}`;

function extractRegistryManifestDigest(manifestJson) {
  const manifest = JSON.parse(manifestJson);
  const digest = manifest.digest;
  if (typeof digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error("invalid registry manifest digest");
  }
  return digest;
}

const formattedManifest = JSON.stringify({
  mediaType: "application/vnd.oci.image.manifest.v1+json",
  digest: manifestDigest,
  size: 1234,
  config: { digest: configDigest },
  layers: [{ digest: layerDigest }],
});

assert.equal(
  extractRegistryManifestDigest(formattedManifest),
  manifestDigest,
  "the descriptor's top-level digest must be used instead of config or layer digests",
);
assert.throws(
  () => extractRegistryManifestDigest(JSON.stringify({ config: { digest: configDigest } })),
  /invalid registry manifest digest/,
  "a config digest must not be accepted as a manifest digest",
);
assert.throws(
  () => extractRegistryManifestDigest(JSON.stringify({ digest: configDigest.toUpperCase() })),
  /invalid registry manifest digest/,
  "the SHA-256 format guard must reject noncanonical digests",
);

assert.match(
  workflow,
  /image_manifest="\$\(docker buildx imagetools inspect "\$image_tag" --format '\{\{json \.Manifest\}\}'\)"/,
  "Buildx must provide the manifest descriptor as structured JSON",
);
assert.match(
  workflow,
  /image_digest="\$\(printf '%s' "\$image_manifest" \| jq -er '\.digest \| strings \| select\(test\("\^sha256:\[a-f0-9\]\{64\}\$"\)\)'\)"/,
  "jq must extract and validate only the descriptor's top-level digest",
);
assert.doesNotMatch(
  workflow,
  /--format '\{\{(?:\.Digest|\.Manifest\.Digest)\}\}'/,
  "unstructured imagetools digest templates must not return",
);
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

const pushPosition = workflow.indexOf('docker push "$image_tag"');
const pushEvidencePosition = workflow.indexOf('echo "STAGING_FILE_SCANNER_IMAGE_PUSH_CONFIRMED: $GITHUB_SHA"');
const digestPosition = workflow.indexOf('image_manifest="$(docker buildx imagetools inspect');
assert.ok(pushPosition >= 0 && pushEvidencePosition > pushPosition && digestPosition > pushEvidencePosition,
  "successful registry push must be recorded before optional digest-inspection failures");
assert.match(workflow, /name: Authenticate, build, push and verify immutable scanner image/,
  "the publication job step must describe all operations it performs, not just OIDC exchange");
console.log("STAGING_FILE_SCANNER_IMAGE_DIGEST_WORKFLOW_TEST_PASS");
