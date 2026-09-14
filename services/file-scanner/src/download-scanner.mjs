import https from "node:https";
import { SafeScannerError, toSafeScannerError } from "./errors.mjs";
import { resolvePublicAddress, createPinnedLookup } from "./dns-pinning.mjs";
import { openClamdInstream } from "./clamd-client.mjs";
import { assertSignaturesFresh } from "./signature-freshness.mjs";
import { MAX_FILE_BYTES } from "./constants.mjs";

function openResponse(url, pinned, config, signal, requestImpl = https.request) {
  return new Promise((resolve, reject) => {
    const request = requestImpl(url, {
      method: "GET",
      headers: { Accept: "*/*", "Accept-Encoding": "identity", "Cache-Control": "no-store" },
      agent: false,
      lookup: createPinnedLookup(url.hostname, pinned),
      servername: url.hostname,
      rejectUnauthorized: true,
    }, resolve);
    const fail = () => reject(new SafeScannerError("DOWNLOAD_FAILURE", 503));
    request.once("error", fail);
    request.setTimeout(config.connectTimeoutMs, () => request.destroy(new Error("DOWNLOAD_TIMEOUT")));
    const onAbort = () => request.destroy(new Error("DOWNLOAD_ABORTED"));
    signal.addEventListener("abort", onAbort, { once: true });
    request.once("close", () => signal.removeEventListener("abort", onAbort));
    request.end();
  });
}

function assertDownloadHeaders(response, expectedSize) {
  if (response.statusCode !== 200) {
    response.destroy();
    throw new SafeScannerError("DOWNLOAD_STATUS_REJECTED", 503);
  }
  const encoding = response.headers["content-encoding"];
  if ((Array.isArray(encoding) && encoding.length !== 1) || (encoding && String(Array.isArray(encoding) ? encoding[0] : encoding).toLowerCase() !== "identity")) {
    response.destroy();
    throw new SafeScannerError("DOWNLOAD_ENCODING_REJECTED", 503);
  }
  const rawLength = response.headers["content-length"];
  if (rawLength !== undefined) {
    if (Array.isArray(rawLength) && rawLength.length !== 1) {
      response.destroy();
      throw new SafeScannerError("DOWNLOAD_SIZE_REJECTED", 503);
    }
    const value = Array.isArray(rawLength) ? rawLength[0] : rawLength;
    if (!/^(0|[1-9]\d*)$/.test(value)) throw new SafeScannerError("DOWNLOAD_SIZE_REJECTED", 503);
    const length = Number(value);
    if (!Number.isSafeInteger(length) || length > MAX_FILE_BYTES || length !== expectedSize) {
      response.destroy();
      throw new SafeScannerError("DOWNLOAD_SIZE_REJECTED", 503);
    }
  }
}

export async function streamResponseToClamd(response, expectedSize, clamdSession, signal) {
  assertDownloadHeaders(response, expectedSize);
  let actual = 0;
  const onAbort = () => {
    response.destroy(new Error("DOWNLOAD_ABORTED"));
    clamdSession.destroy();
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for await (const chunk of response) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      actual += bytes.length;
      if (actual > expectedSize || actual > MAX_FILE_BYTES) {
        response.destroy();
        throw new SafeScannerError("DOWNLOAD_SIZE_REJECTED", 503);
      }
      await clamdSession.writeChunk(bytes);
    }
    if (actual !== expectedSize) throw new SafeScannerError("DOWNLOAD_SIZE_REJECTED", 503);
    return await clamdSession.finish();
  } catch (error) {
    clamdSession.destroy();
    throw toSafeScannerError(error, "DOWNLOAD_FAILURE");
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function scanRemoteObject(input, config, dependencies = {}) {
  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(), config.totalTimeoutMs);
  let response;
  let clamdSession;
  try {
    await (dependencies.assertSignaturesFresh ?? assertSignaturesFresh)(config);
    const pinned = await (dependencies.resolvePublicAddress ?? resolvePublicAddress)(
      input.sourceUrl.hostname,
      config.dnsTimeoutMs,
      dependencies.resolveDns,
    );
    clamdSession = await (dependencies.openClamdInstream ?? openClamdInstream)(config);
    response = await openResponse(
      input.sourceUrl,
      pinned,
      config,
      controller.signal,
      dependencies.httpsRequest,
    );
    response.setTimeout(config.downloadTimeoutMs, () => response.destroy(new Error("DOWNLOAD_TIMEOUT")));
    return await streamResponseToClamd(response, input.sizeBytes, clamdSession, controller.signal);
  } catch (error) {
    response?.destroy();
    clamdSession?.destroy();
    if (controller.signal.aborted) throw new SafeScannerError("SCAN_TIMEOUT", 503);
    throw toSafeScannerError(error);
  } finally {
    clearTimeout(totalTimer);
  }
}
