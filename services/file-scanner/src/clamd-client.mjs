import net from "node:net";
import { SafeScannerError } from "./errors.mjs";

const MAX_CLAMD_RESPONSE_BYTES = 4_096;
const MAX_CLAMD_CHUNK_BYTES = 64 * 1024;

function waitForSocket(socket, event, timeoutMs, category) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new SafeScannerError(category, 503)), timeoutMs);
    const onEvent = (...args) => finish(null, args);
    const onError = () => finish(new SafeScannerError(category, 503));
    function finish(error, args) {
      clearTimeout(timeout);
      socket.off(event, onEvent);
      socket.off("error", onError);
      if (error) reject(error);
      else resolve(args);
    }
    socket.once(event, onEvent);
    socket.once("error", onError);
  });
}

function write(socket, data) {
  return new Promise((resolve, reject) => {
    if (socket.destroyed) {
      reject(new SafeScannerError("CLAMD_UNAVAILABLE", 503));
      return;
    }
    socket.write(data, (error) => {
      if (error) reject(new SafeScannerError("CLAMD_UNAVAILABLE", 503));
      else resolve();
    });
  });
}

export async function openClamdInstream(config, createConnection = net.createConnection) {
  const socket = createConnection({ host: config.clamdHost, port: config.clamdPort });
  socket.setNoDelay(true);
  await waitForSocket(socket, "connect", config.clamdConnectTimeoutMs, "CLAMD_UNAVAILABLE");
  let socketFailed = false;
  socket.on("error", () => {
    socketFailed = true;
  });
  socket.setTimeout(config.clamdScanTimeoutMs, () => socket.destroy(new Error("CLAMD_TIMEOUT")));
  await write(socket, Buffer.from("zINSTREAM\0"));
  let finished = false;

  return {
    async writeChunk(chunk) {
      if (finished || socketFailed) throw new SafeScannerError("CLAMD_PROTOCOL_FAILURE", 503);
      for (let offset = 0; offset < chunk.length; offset += MAX_CLAMD_CHUNK_BYTES) {
        const part = chunk.subarray(offset, Math.min(offset + MAX_CLAMD_CHUNK_BYTES, chunk.length));
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(part.length);
        await write(socket, length);
        await write(socket, part);
      }
    },
    async finish() {
      if (finished || socketFailed) throw new SafeScannerError("CLAMD_PROTOCOL_FAILURE", 503);
      finished = true;
      await write(socket, Buffer.alloc(4));
      const response = await readClamdResponse(socket);
      socket.end();
      if (/: OK$/.test(response)) return "CLEAN";
      if (/: .+ FOUND$/.test(response)) return "MALICIOUS";
      throw new SafeScannerError("CLAMD_SCAN_FAILURE", 503);
    },
    destroy() {
      finished = true;
      socket.destroy();
    },
  };
}

function readClamdResponse(socket) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const onData = (chunk) => {
      total += chunk.length;
      if (total > MAX_CLAMD_RESPONSE_BYTES) return fail();
      const nul = chunk.indexOf(0);
      chunks.push(nul >= 0 ? chunk.subarray(0, nul) : chunk);
      if (nul >= 0) done();
    };
    const onError = () => fail();
    const onEnd = () => fail();
    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
    }
    function fail() {
      cleanup();
      socket.destroy();
      reject(new SafeScannerError("CLAMD_SCAN_FAILURE", 503));
    }
    function done() {
      cleanup();
      resolve(Buffer.concat(chunks).toString("utf8"));
    }
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("end", onEnd);
  });
}

export async function pingClamd(config, createConnection = net.createConnection) {
  const socket = createConnection({ host: config.clamdHost, port: config.clamdPort });
  try {
    socket.setTimeout(config.clamdConnectTimeoutMs, () => socket.destroy(new Error("CLAMD_TIMEOUT")));
    await waitForSocket(socket, "connect", config.clamdConnectTimeoutMs, "CLAMD_UNAVAILABLE");
    socket.on("error", () => {});
    await write(socket, Buffer.from("zPING\0"));
    const response = await readClamdResponse(socket);
    if (response !== "PONG") throw new SafeScannerError("CLAMD_UNAVAILABLE", 503);
  } catch {
    throw new SafeScannerError("CLAMD_UNAVAILABLE", 503);
  } finally {
    socket.destroy();
  }
}
