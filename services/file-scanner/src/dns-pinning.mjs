import { lookup as dnsLookup } from "node:dns/promises";
import { SafeScannerError } from "./errors.mjs";
import { isPublicRoutableAddress } from "./ip-policy.mjs";

function withTimeout(promise, timeoutMs) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new SafeScannerError("DNS_FAILURE", 503)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

export async function resolvePublicAddress(hostname, timeoutMs, resolver = dnsLookup) {
  let records;
  try {
    records = await withTimeout(resolver(hostname, { all: true, verbatim: true }), timeoutMs);
  } catch {
    throw new SafeScannerError("DNS_FAILURE", 503);
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new SafeScannerError("DNS_FAILURE", 503);
  }
  const normalized = records.map((record) => ({ address: record.address, family: Number(record.family) }));
  if (normalized.some((record) => ![4, 6].includes(record.family) || !isPublicRoutableAddress(record.address))) {
    throw new SafeScannerError("DNS_ADDRESS_REJECTED", 400);
  }
  return Object.freeze(normalized[0]);
}

export function createPinnedLookup(hostname, pinned) {
  return (requestedHostname, options, callback) => {
    if (requestedHostname !== hostname) {
      callback(new Error("PINNED_DNS_HOST_MISMATCH"));
      return;
    }
    if (options && typeof options === "object" && options.all) {
      callback(null, [pinned]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}
