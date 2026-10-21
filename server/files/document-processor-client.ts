import "server-only";
import { isIP } from "node:net";

export const DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const DOCUMENT_PROCESSOR_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
// Up to 40 PDF pages can each take three 30-second subprocesses (text extraction, rasterization, OCR), plus a bounded response margin.
export const DOCUMENT_PROCESSOR_TIMEOUT_MS = 3_900_000;
export const DOCUMENT_PROCESSOR_INVALID_CONFIG = "DOCUMENT_PROCESSOR_INVALID_CONFIG";
export const DOCUMENT_PROCESSOR_REQUEST_FAILED = "DOCUMENT_PROCESSOR_REQUEST_FAILED";

export type DocumentProcessorConfig = {
  baseUrl: string;
  token: string;
  allowedPublicHost?: string;
};

export type ExtractedDocumentText = {
  text: string;
  pageTexts: readonly string[];
  pageLines?: readonly (readonly ExtractedDocumentLine[])[];
  pages: number;
};

export type ExtractedDocumentLine = {
  text: string;
  box: null | { left: number; top: number; width: number; height: number };
  confidence: number | null;
};

type FetchLike = typeof fetch;

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".");
  if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const [first, second, third, fourth] = octets.map(Number);
  if ([first, second, third, fourth].some((part) => part < 0 || part > 255)) return false;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function normalizeAllowedPublicHost(value: string | undefined) {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(`https://${value.trim()}`);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (
    !hostname ||
    isIP(hostname.replace(/^\[|\]$/g, "")) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  return hostname;
}

function isAllowedProcessorUrl(value: string, allowedPublicHost?: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const privateHost =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "document-processor" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    isPrivateIpv4(hostname);
  const pinnedPublicHost =
    url.protocol === "https:" &&
    !!allowedPublicHost &&
    hostname === allowedPublicHost &&
    !isIP(hostname);
  return (
    (privateHost || pinnedPublicHost) &&
    (url.protocol === "https:" || url.protocol === "http:") &&
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
  const allowedPublicHost = normalizeAllowedPublicHost(env.IB_DOCUMENT_PROCESSOR_ALLOWED_PUBLIC_HOST);
  if (
    !baseUrl ||
    allowedPublicHost === null ||
    !isAllowedProcessorUrl(baseUrl, allowedPublicHost)
  ) {
    throw new Error(`${DOCUMENT_PROCESSOR_INVALID_CONFIG}:URL`);
  }
  if (!token || token.length < 32 || /[\r\n\0]/.test(token)) {
    throw new Error(`${DOCUMENT_PROCESSOR_INVALID_CONFIG}:TOKEN`);
  }
  return {
    baseUrl: new URL(baseUrl).origin,
    token,
    ...(allowedPublicHost ? { allowedPublicHost } : {}),
  };
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
    if (
      !isAllowedProcessorUrl(config.baseUrl, config.allowedPublicHost) ||
      config.token.trim().length < 32
    ) {
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
    if (!data || typeof data !== "object") {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
    }
    const pageTexts = (data as { pageTexts?: unknown }).pageTexts;
    const pageLines = (data as { pageLines?: unknown }).pageLines;
    const pages = (data as { pages?: unknown }).pages;
    if (
      !Array.isArray(pageTexts) ||
      !Number.isInteger(pages) ||
      (pages as number) < 1 ||
      (pages as number) > 40 ||
      pageTexts.length !== pages ||
      pageTexts.some((pageText) => typeof pageText !== "string" || pageText.includes("\0")) ||
      pageTexts.reduce((total, pageText) => total + pageText.length, 0) > 500_000
    ) {
      throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
    }
    const typedPageTexts = pageTexts as string[];
    let typedPageLines: ExtractedDocumentLine[][];
    if (pageLines === undefined) {
      typedPageLines = typedPageTexts.map((pageText) => pageText.split(/\r?\n/u)
        .filter((line) => line.trim().length > 0)
        .map((text) => ({ text, box: null, confidence: null })));
    } else {
      if (!Array.isArray(pageLines) || pageLines.length !== pages) {
        throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
      }
      let totalLines = 0;
      typedPageLines = pageLines.map((page) => {
        if (!Array.isArray(page) || page.length > 3_000) {
          throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
        }
        totalLines += page.length;
        if (totalLines > 10_000) throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
        return page.map((line): ExtractedDocumentLine => {
          if (!line || typeof line !== "object" || Array.isArray(line)) {
            throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
          }
          const record = line as Record<string, unknown>;
          const box = record.box;
          const validBox = box === null || (
            !!box && typeof box === "object" && !Array.isArray(box) &&
            ["left", "top", "width", "height"].every((key) => Number.isSafeInteger((box as Record<string, unknown>)[key])) &&
            ["left", "top", "width", "height"].every((key) => ((box as Record<string, number>)[key] ?? -1) >= 0) &&
            (box as Record<string, number>).width > 0 && (box as Record<string, number>).height > 0
          );
          if (
            typeof record.text !== "string" || record.text.length < 1 || record.text.length > 2_000 ||
            !validBox ||
            !(record.confidence === null || (typeof record.confidence === "number" && Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 100))
          ) throw new Error(`${DOCUMENT_PROCESSOR_REQUEST_FAILED}:INVALID_RESPONSE`);
          return {
            text: record.text,
            box: box as ExtractedDocumentLine["box"],
            confidence: record.confidence as number | null,
          };
        });
      });
    }
    return {
      text: typedPageTexts.join("\n\n"),
      pageTexts: typedPageTexts,
      pageLines: typedPageLines,
      pages: pages as number,
    };
  }
}
