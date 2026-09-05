import { createHash, createHmac } from "node:crypto";

export const AWS_SIGV4_ALGORITHM = "AWS4-HMAC-SHA256";

export type AwsSigV4Input = {
  method: string;
  canonicalPath: string;
  canonicalQuery?: string;
  headers: Record<string, string>;
  payload: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  now?: Date;
};

export type AwsSigV4Result = {
  authorization: string;
  amzDate: string;
  signedHeaders: string;
  credentialScope: string;
};

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function normalizeHeaderValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function formatAwsDate(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error("AWS_SIGV4_INVALID_DATE");
  const iso = date.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

export function signAwsV4Request(input: AwsSigV4Input): AwsSigV4Result {
  const method = input.method.trim().toUpperCase();
  if (!method || !input.canonicalPath.startsWith("/")) throw new Error("AWS_SIGV4_INVALID_REQUEST");
  if (!input.region.trim() || !input.service.trim()) throw new Error("AWS_SIGV4_INVALID_SCOPE");
  if (!input.accessKeyId.trim() || !input.secretAccessKey) throw new Error("AWS_SIGV4_INVALID_CREDENTIALS");

  const now = input.now ?? new Date();
  const amzDate = formatAwsDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const headers = { ...input.headers, "x-amz-date": amzDate };

  const normalizedHeaders = Object.entries(headers)
    .map(([name, value]) => [name.trim().toLowerCase(), normalizeHeaderValue(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  if (!normalizedHeaders.some(([name]) => name === "host")) throw new Error("AWS_SIGV4_HOST_REQUIRED");
  if (normalizedHeaders.some(([name], index) => index > 0 && normalizedHeaders[index - 1]?.[0] === name)) {
    throw new Error("AWS_SIGV4_DUPLICATE_HEADER");
  }

  const canonicalHeaders = normalizedHeaders.map(([name, value]) => `${name}:${value}\n`).join("");
  const signedHeaders = normalizedHeaders.map(([name]) => name).join(";");
  const canonicalQuery = input.canonicalQuery ?? "";
  const payloadHash = sha256Hex(input.payload);
  const canonicalRequest = [
    method,
    input.canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    AWS_SIGV4_ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const dateKey = hmacSha256(`AWS4${input.secretAccessKey}`, dateStamp);
  const regionKey = hmacSha256(dateKey, input.region);
  const serviceKey = hmacSha256(regionKey, input.service);
  const signingKey = hmacSha256(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return {
    amzDate,
    signedHeaders,
    credentialScope,
    authorization: `${AWS_SIGV4_ALGORITHM} Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
