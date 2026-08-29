import "dotenv/config";

import {
  GetBucketAclCommand,
  GetBucketCorsCommand,
  GetBucketPolicyCommand,
  HeadBucketCommand,
  S3Client,
  type CORSRule,
} from "@aws-sdk/client-s3";
import { assertStagingStorageTarget } from "./staging-storage-target-guard";

const STAGING_STORAGE_VERIFY_FAIL = "STAGING_STORAGE_VERIFY_FAIL";
const STAGING_STORAGE_POLICY_REVIEW_REQUIRED = "STAGING_STORAGE_POLICY_REVIEW_REQUIRED";

function fail(message: string): never {
  console.error(`${STAGING_STORAGE_VERIFY_FAIL}: ${message}`);
  process.exit(1);
}

function errorStatus(error: unknown) {
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

function isMissingOptionalBucketConfiguration(error: unknown, expectedName: string) {
  return errorName(error) === expectedName;
}

function isPublicAclGroupUri(uri: string | undefined) {
  if (!uri) return false;
  return uri.endsWith("/AllUsers") || uri.endsWith("/AuthenticatedUsers");
}

function policyContainsAllow(policyText: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(policyText);
  } catch {
    fail("bucket policy is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") fail("bucket policy has an invalid root");
  const statementValue = (parsed as { Statement?: unknown }).Statement;
  if (statementValue === undefined) fail("bucket policy has no Statement");
  const statements = Array.isArray(statementValue) ? statementValue : [statementValue];

  for (const statement of statements) {
    if (!statement || typeof statement !== "object") {
      fail("bucket policy contains an invalid Statement");
    }
    const effect = (statement as { Effect?: unknown }).Effect;
    if (effect === "Allow") return true;
    if (effect !== "Deny") fail("bucket policy contains a Statement with an unknown Effect");
  }

  return false;
}

function assertCorsRules(rules: readonly CORSRule[], expectedOrigin: string) {
  if (rules.length === 0) fail("bucket CORS configuration is empty");

  let supportsSignedUpload = false;
  for (const rule of rules) {
    const origins = rule.AllowedOrigins ?? [];
    if (origins.some((origin) => origin.includes("*"))) {
      fail("bucket CORS contains a wildcard AllowedOrigin");
    }
    for (const origin of origins) {
      if (origin !== expectedOrigin) {
        fail("bucket CORS contains an origin other than IB_STAGING_STORAGE_ALLOWED_ORIGIN");
      }
    }

    const methods = new Set((rule.AllowedMethods ?? []).map((method) => method.toUpperCase()));
    const headers = (rule.AllowedHeaders ?? []).map((header) => header.toLowerCase());
    const allowsContentType = headers.includes("*") || headers.includes("content-type");
    if (origins.includes(expectedOrigin) && methods.has("PUT") && allowsContentType) {
      supportsSignedUpload = true;
    }
  }

  if (!supportsSignedUpload) {
    fail("bucket CORS does not allow signed browser PUT with Content-Type from the staging origin");
  }
}

let target: ReturnType<typeof assertStagingStorageTarget>;
try {
  target = assertStagingStorageTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging storage target");
}

const endpoint = "https://storage.yandexcloud.net";
const client = new S3Client({
  endpoint,
  region: "ru-central1",
  credentials: {
    accessKeyId: target.accessKeyId,
    secretAccessKey: target.secretAccessKey,
  },
});

try {
  await client.send(new HeadBucketCommand({ Bucket: target.bucket }));

  const acl = await client.send(new GetBucketAclCommand({ Bucket: target.bucket }));
  const publicAclGrant = (acl.Grants ?? []).some((grant) => isPublicAclGroupUri(grant.Grantee?.URI));
  if (publicAclGrant) fail("bucket ACL grants access to a public S3 group");

  let policyState: "absent" | "deny-only" = "absent";
  try {
    const policy = await client.send(new GetBucketPolicyCommand({ Bucket: target.bucket }));
    if (policy.Policy) {
      if (policyContainsAllow(policy.Policy)) {
        console.error(
          `${STAGING_STORAGE_POLICY_REVIEW_REQUIRED}: bucket policy contains Allow semantics; manual principal/condition review is required and policy content was not printed`,
        );
        process.exit(1);
      }
      policyState = "deny-only";
    }
  } catch (error) {
    if (!isMissingOptionalBucketConfiguration(error, "NoSuchBucketPolicy")) throw error;
  }

  let corsRules: CORSRule[] = [];
  try {
    const cors = await client.send(new GetBucketCorsCommand({ Bucket: target.bucket }));
    corsRules = cors.CORSRules ?? [];
  } catch (error) {
    if (!isMissingOptionalBucketConfiguration(error, "NoSuchCORSConfiguration")) throw error;
    fail("bucket CORS configuration is missing");
  }
  assertCorsRules(corsRules, target.allowedOrigin);

  console.log(`Staging Object Storage bucket identity verified: ${target.bucket}`);
  console.log("Staging Object Storage access-key identity verified");
  console.log(`Staging Object Storage CORS origin identity verified: ${target.allowedOrigin}`);
  console.log("Bucket ACL verified: no public S3 group grants");
  console.log(`Bucket policy verified: ${policyState}`);
  console.log(`Bucket CORS verified for exact staging origin: ${target.allowedOrigin}`);
  console.log("Object enumeration/content operations performed: 0");
  console.log("STAGING_OBJECT_STORAGE_VERIFY_PASS");
} catch (error) {
  const status = errorStatus(error);
  if (status === 403) {
    fail("service account cannot read required bucket security metadata");
  }
  const name = errorName(error) || "UnknownS3Error";
  fail(`S3 metadata verification failed (${name}${status ? `:${status}` : ""})`);
} finally {
  client.destroy();
}
