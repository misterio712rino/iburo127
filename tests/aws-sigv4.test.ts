import assert from "node:assert/strict";
import { signAwsV4Request } from "@/server/email/aws-sigv4";

const result = signAwsV4Request({
  method: "GET",
  canonicalPath: "/",
  canonicalQuery: "Action=ListUsers&Version=2010-05-08",
  headers: {
    "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    host: "iam.amazonaws.com",
  },
  payload: "",
  region: "us-east-1",
  service: "iam",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  now: new Date("2015-08-30T12:36:00.000Z"),
});

assert.equal(result.amzDate, "20150830T123600Z");
assert.equal(result.credentialScope, "20150830/us-east-1/iam/aws4_request");
assert.equal(result.signedHeaders, "content-type;host;x-amz-date");
assert.equal(
  result.authorization,
  "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
);

console.log("AWS_SIGV4_TEST_PASS");
