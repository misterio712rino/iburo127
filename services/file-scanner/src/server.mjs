import { readScannerConfig } from "./config.mjs";
import { createScannerServer } from "./service.mjs";

const config = readScannerConfig();
const server = createScannerServer(config);
let stopping = false;

function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(config.port, config.host, () => {
  console.info(JSON.stringify({ event: "service_started" }));
});
