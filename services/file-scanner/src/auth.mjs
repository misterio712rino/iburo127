import { createHash, timingSafeEqual } from "node:crypto";
import { SafeScannerError } from "./errors.mjs";

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function authorizeRawHeaders(rawHeaders, configuredSecret) {
  const values = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (String(rawHeaders[index]).toLowerCase() === "authorization") {
      values.push(String(rawHeaders[index + 1] ?? ""));
    }
  }
  if (values.length !== 1 || !values[0].startsWith("Bearer ")) {
    throw new SafeScannerError("UNAUTHORIZED", 401);
  }
  const credential = values[0].slice("Bearer ".length);
  if (!credential || /[\u0000-\u001f\u007f]/.test(credential)) {
    throw new SafeScannerError("UNAUTHORIZED", 401);
  }
  if (!timingSafeEqual(digest(credential), digest(configuredSecret))) {
    throw new SafeScannerError("UNAUTHORIZED", 401);
  }
}
