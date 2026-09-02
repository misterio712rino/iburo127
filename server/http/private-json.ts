import "server-only";

const PRIVATE_JSON_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

export function privateJsonResponse<T>(
  body: T,
  status = 200,
  additionalHeaders?: HeadersInit,
): Response {
  const headers = new Headers(additionalHeaders);
  for (const [key, value] of Object.entries(PRIVATE_JSON_HEADERS)) {
    headers.set(key, value);
  }

  return Response.json(body, {
    status,
    headers,
  });
}
