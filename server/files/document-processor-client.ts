import "server-only";

export const DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const DOCUMENT_PROCESSOR_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_PROCESSOR_TIMEOUT_MS = 45_000;
export const DOCUMENT_PROCESSOR_INVALID_CONFIG = "DOCUMENT_PROCESSOR_INVALID_CONFIG";
export const DOCUMENT_PROCESSOR_REQUEST_FAILED = "DOCUMENT_PROCESSOR_REQUEST_FAILED";

export type DocumentProcessorConfig = {
  baseUrl: string;
  token: string;
};

export type ExtractedDocumentText = {
  text: string;
  pages: number;
};

type FetchLike = typeof fetch;

function isAllowedProcessorUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const localHttpHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname === "document-processor" ||
    url.hostname.endsWith(".internal") ||
    url.hostname.endsWith(".local");
  return (
    (url.protocol === "https:" || (url.protocol === "http:" && localHttpHost)) &&
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash
  );
}

export function readDocumentProcessorConfig(
  env: Record<string, string | undefined> = process.env,
): DocumentProcessorConfig {
  const baseUrl = env.IB_DOCUMENT_PROCESSOR_URL?.trim();
  const token = env.IB_DOCUMENT_PROCESSOR_TOKEN?.trim();
  if (!baseUrl || !isAllowedProcessorUrl(baseUrl)) {
    throw new Error(`${DOCUMENT_PROCESSOR_INVALID_CONFIG}:URL`);
  }
  if (!token || token.length < 32 || /[\r\n\0]/.test(token)) {
    throw new Error(`${DOCUMENT_PROCESSOR_INVALID_CONFIG}:TOKEN`);
  }
  return { baseUrl: new URL(baseUrl).origin, token };
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const advertised = response.headers.get("content-length");
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > DOCUMENT_PROCESSOR_MAX_RESPONSE_BYTES)) {
    throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:RESPONSE_TOO_LARGE`);
  }
  if (!response.body) throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:EMPTY_RESPONSE`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > DOCUMENT_PROCESSOR_MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:RESPONSE_TOO_LARGE`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function responseErrorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Z0-9_:-]{1,80}$/.test(code) ? code : null;
}

export class DocumentProcessorClient {
  constructor(
    private readonly config: DocumentProcessorConfig,
    private readonly request: FetchLike = fetch,
  ) {
    if (!isAllowedProcessorUrl(config.baseUrl) || config.token.trim().length < 32) {
      throw new Error(DOCUMENT_PROCESSOR_INVALID_CONFIG);
    }
  }

  async extract(input: { bytes: Uint8Array; mimeType: string }): Promise<ExtractedDocumentText> {
    if (
      input.bytes.byteLength < 1 ||
      input.bytes.byteLength > DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES ||
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(input.mimeType)
    ) {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_INPUT`);
    }

    let response: Response;
    try {
      response = await this.request(new URL("/v1/extract", this.config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": input.mimeType,
          "Content-Length": String(input.bytes.byteLength),
        },
        body: Buffer.from(input.bytes),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(DOCUMENT_PROCESSOR_TIMEOUT_MS),
      });
    } catch {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:TRANSPORT`);
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
    }

    const body = await readBoundedBody(response);
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    } catch {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
    }

    if (!response.ok) {
      const code = responseErrorCode(payload);
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:${code ?? response.status}`);
    }
    if (!payload || typeof payload !== "object" || (payload as { ok?: unknown }).ok !== true) {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
    }
    const data = (payload as { data?: unknown }).data;
    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as { text?: unknown }).text !== "string" ||
      !Number.isInteger((data as { pages?: unknown }).pages) ||
      (data as { pages: number }).pages < 1 ||
      (data as { pages: number }).pages > 40 ||
      (data as { text: string }).text.length > 500_000
    ) {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
    }
    return { text: (data as { text: string }).text, pages: (data as { pages: number }).pages };
  }
}
