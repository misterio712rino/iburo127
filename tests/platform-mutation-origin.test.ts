import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED,
  PLATFORM_MUTATION_ORIGIN_REJECTED,
  evaluatePlatformMutationOrigin,
} from "@/server/http/trusted-mutation-origin";

const productionEnv = { BETTER_AUTH_URL: "https://app.example.com" };

function request(
  method: string,
  options: { origin?: string; fetchSite?: string } = {},
): Pick<Request, "method" | "headers"> {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.fetchSite !== undefined) headers.set("sec-fetch-site", options.fetchSite);
  return { method, headers };
}

for (const method of ["GET", "HEAD", "OPTIONS"]) {
  assert.deepEqual(evaluatePlatformMutationOrigin(request(method), {}), { allowed: true });
}

for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
  assert.deepEqual(
    evaluatePlatformMutationOrigin(
      request(method, { origin: "https://app.example.com", fetchSite: "same-origin" }),
      productionEnv,
    ),
    { allowed: true },
  );
}

assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { origin: "https://app.example.com" }),
    productionEnv,
  ),
  { allowed: true },
  "non-browser staging verifier may omit Fetch Metadata when exact Origin is present",
);

for (const invalidRequest of [
  request("POST"),
  request("POST", { origin: "null" }),
  request("POST", { origin: "https://evil.example" }),
  request("POST", { origin: "https://sub.app.example.com" }),
  request("POST", { origin: "https://app.example.com/extra" }),
  request("POST", { origin: "https://app.example.com", fetchSite: "cross-site" }),
  request("POST", { origin: "https://app.example.com", fetchSite: "same-site" }),
  request("POST", { origin: "https://app.example.com", fetchSite: "none" }),
]) {
  assert.deepEqual(evaluatePlatformMutationOrigin(invalidRequest, productionEnv), {
    allowed: false,
    status: 403,
    code: PLATFORM_MUTATION_ORIGIN_REJECTED,
  });
}

for (const invalidEnv of [
  {},
  { BETTER_AUTH_URL: "" },
  { BETTER_AUTH_URL: "not-a-url" },
  { BETTER_AUTH_URL: "http://app.example.com" },
  { BETTER_AUTH_URL: "https://user:pass@app.example.com" },
  { BETTER_AUTH_URL: "https://app.example.com/path" },
  { BETTER_AUTH_URL: "https://app.example.com?query=1" },
]) {
  assert.deepEqual(
    evaluatePlatformMutationOrigin(
      request("PATCH", { origin: "https://app.example.com" }),
      invalidEnv,
    ),
    {
      allowed: false,
      status: 503,
      code: PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED,
    },
  );
}

assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { origin: "http://localhost:3000" }),
    { BETTER_AUTH_URL: "http://localhost:3000" },
  ),
  { allowed: true },
);
assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { origin: "http://127.0.0.1:3000" }),
    { BETTER_AUTH_URL: "http://127.0.0.1:3000" },
  ),
  { allowed: true },
);

const proxySource = await readFile(resolve("proxy.ts"), "utf8");
assert.match(proxySource, /evaluatePlatformMutationOrigin\(request\)/);
assert.match(proxySource, /matcher:\s*\["\/api\/platform\/:path\*"\]/);
assert.match(proxySource, /Cache-Control": "private, no-store"/);
assert.doesNotMatch(proxySource, /\/api\/auth/);
assert.doesNotMatch(proxySource, /\/api\/internal/);

console.log("PLATFORM_MUTATION_ORIGIN_TEST_PASS");
