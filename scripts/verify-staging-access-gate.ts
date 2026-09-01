import "dotenv/config";

import {
  requireStagingHttpTarget,
  STAGING_HTTP_TARGET_GUARD,
} from "./staging-http-target-guard";

const FAIL = "STAGING_ACCESS_GATE_E2E_FAIL";

function fail(message: string): never {
  throw new Error(`${FAIL}: ${message}`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

let baseUrl: URL;
try {
  baseUrl = requireStagingHttpTarget(process.env);
} catch (error) {
  const message =
    error instanceof Error && error.message.startsWith(`${STAGING_HTTP_TARGET_GUARD}:`)
      ? error.message
      : `${STAGING_HTTP_TARGET_GUARD}:UNEXPECTED`;
  fail(message);
}

const managerCookie = required("IB_STAGING_MANAGER_COOKIE");
const knownEmails = [
  ["CLIENT", required("IB_STAGING_CLIENT_EMAIL")],
  ["LAWYER", required("IB_STAGING_LAWYER_EMAIL")],
  ["MANAGER", required("IB_STAGING_MANAGER_EMAIL")],
] as const;
const exactSha = required("GITHUB_SHA");
if (!/^[a-f0-9]{40}$/.test(exactSha)) fail("GITHUB_SHA is not an exact lowercase SHA");
const prospectEmail = `staging.e2e.${exactSha.slice(0, 16)}@example.test`;

type AccessGateEnvelope = {
  ok: boolean;
  data?: {
    state?: string;
    challenge?: string;
    purchaseUrl?: string;
  };
  error?: { code?: string };
};

async function postIdentifier(identifier: string): Promise<AccessGateEnvelope> {
  const response = await fetch(new URL("/api/public/access-gate", baseUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: baseUrl.origin,
    },
    body: JSON.stringify({ identifier }),
    redirect: "manual",
  });

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl.includes("no-store")) fail("access-gate response is missing no-store");

  const text = await response.text();
  let body: AccessGateEnvelope;
  try {
    body = JSON.parse(text) as AccessGateEnvelope;
  } catch {
    fail(`access-gate returned non-JSON status ${response.status}`);
  }

  if (response.status !== 200 || !body.ok) {
    fail(`access-gate rejected ${identifier} with status ${response.status}/${body.error?.code ?? "UNKNOWN"}`);
  }
  return body;
}

async function verifyKnownAccounts(): Promise<void> {
  for (const [role, email] of knownEmails) {
    const body = await postIdentifier(email);
    if (body.data?.state !== "LOGIN") fail(`${role} did not resolve to LOGIN`);
    if (typeof body.data.challenge !== "string" || body.data.challenge.length < 20) {
      fail(`${role} did not receive an opaque login challenge`);
    }
    if (JSON.stringify(body).toLowerCase().includes(email.toLowerCase())) {
      fail(`${role} access-gate response leaked the submitted email`);
    }
    console.log(`ACCESS_GATE_${role}: LOGIN challenge verified`);
  }
}

async function verifyProspect(): Promise<void> {
  const first = await postIdentifier(prospectEmail);
  if (
    first.data?.state !== "PROSPECT" ||
    first.data.purchaseUrl !== "https://iburo127.ru/" ||
    first.data.challenge
  ) {
    fail("unknown contact did not resolve to the expected PROSPECT response");
  }

  const second = await postIdentifier(prospectEmail);
  if (
    second.data?.state !== "PROSPECT" ||
    second.data.purchaseUrl !== "https://iburo127.ru/"
  ) {
    fail("repeated unknown contact did not remain a PROSPECT");
  }

  const leadsResponse = await fetch(new URL("/portal/leads", baseUrl), {
    method: "GET",
    headers: { cookie: managerCookie, accept: "text/html" },
    redirect: "manual",
  });
  if (leadsResponse.status !== 200) {
    fail(`MANAGER leads page expected 200, got ${leadsResponse.status}`);
  }
  const html = await leadsResponse.text();
  const occurrences = html.split(prospectEmail).length - 1;
  if (occurrences !== 1) {
    fail(`expected one deduplicated prospect row, observed ${occurrences}`);
  }

  console.log("ACCESS_GATE_PROSPECT: redirect target and deduplicated manager lead verified");
}

await verifyKnownAccounts();
await verifyProspect();
console.log("STAGING_ACCESS_GATE_E2E_PASS");
