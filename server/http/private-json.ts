import "server-only";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

function withPrivateHeaders(additionalHeaders?: HeadersInit) {
  const headers = new Headers(additionalHeaders);
  for (const [key, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
    headers.set(key, value);
  }
  return headers;
}

export function privateJsonResponse<T>(
  body: T,
  status = 200,
  additionalHeaders?: HeadersInit,
): Response {
  return Response.json(body, {
    status,
    headers: withPrivateHeaders(additionalHeaders),
  });
}

export function privateResponse(
  body: BodyInit | null,
  init: ResponseInit = {},
): Response {
  return new Response(body, {
    ...init,
    headers: withPrivateHeaders(init.headers),
  });
}
