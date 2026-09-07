import http from "node:http";
import { authorizeRawHeaders } from "./auth.mjs";
import { RESPONSE_HEADERS } from "./constants.mjs";
import { SafeScannerError, toSafeScannerError } from "./errors.mjs";
import { readBoundedJson } from "./request-policy.mjs";
import { assertTrustedSourceUrl } from "./source-url-policy.mjs";
import { scanRemoteObject } from "./download-scanner.mjs";
import { checkHealth } from "./health.mjs";

function send(response, status, body) {
  const encoded = JSON.stringify(body);
  response.writeHead(status, { ...RESPONSE_HEADERS, "Content-Length": Buffer.byteLength(encoded) });
  response.end(encoded);
}

function requireJsonHeaders(request) {
  const contentType = String(request.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new SafeScannerError("INVALID_CONTENT_TYPE", 415);
  const accept = String(request.headers.accept ?? "").toLowerCase();
  if (!accept.split(",").some((entry) => entry.trim().split(";", 1)[0] === "application/json")) {
    throw new SafeScannerError("INVALID_ACCEPT", 406);
  }
}

export class CapacityGate {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
  }
  acquire() {
    if (this.active >= this.limit) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.active -= 1;
      }
    };
  }
}

function defaultLogger(event, category) {
  const record = category ? { event, category } : { event };
  console.info(JSON.stringify(record));
}

export function createScannerHandler(config, dependencies = {}) {
  const capacity = dependencies.capacity ?? new CapacityGate(config.concurrency);
  const logger = dependencies.logger ?? defaultLogger;
  const scan = dependencies.scanRemoteObject ?? scanRemoteObject;
  const health = dependencies.checkHealth ?? checkHealth;

  return async (request, response) => {
    let release;
    try {
      authorizeRawHeaders(request.rawHeaders, config.secret);
      const url = new URL(request.url ?? "/", "http://scanner.internal");
      if (request.method === "GET" && url.pathname === "/health" && !url.search) {
        await health(config);
        send(response, 200, { status: "ok" });
        return;
      }
      if (request.method !== "POST" || url.pathname !== "/v1/scan-url" || url.search) {
        throw new SafeScannerError("NOT_FOUND", 404);
      }
      requireJsonHeaders(request);
      release = capacity.acquire();
      if (!release) throw new SafeScannerError("CAPACITY_EXHAUSTED", 503);
      const input = await readBoundedJson(request, undefined, config.requestBodyTimeoutMs);
      const sourceUrl = assertTrustedSourceUrl(input.sourceUrl);
      const verdict = await scan({ ...input, sourceUrl }, config);
      if (verdict !== "CLEAN" && verdict !== "MALICIOUS") {
        throw new SafeScannerError("INVALID_ENGINE_VERDICT", 503);
      }
      logger("scan_complete", verdict === "CLEAN" ? "clean" : "malicious");
      send(response, 200, { verdict });
    } catch (error) {
      const safe = toSafeScannerError(error);
      logger("request_failed", safe.category);
      if (!response.headersSent && !response.destroyed) {
        const body = safe.status === 401 ? { error: "UNAUTHORIZED" } : { error: "REQUEST_FAILED" };
        send(response, safe.status, body);
      } else if (!response.destroyed) {
        response.destroy();
      }
    } finally {
      release?.();
    }
  };
}

export function createScannerServer(config, dependencies = {}) {
  const server = http.createServer(createScannerHandler(config, dependencies));
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;
  return server;
}
