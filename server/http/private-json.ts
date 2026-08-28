import "server-only";

const PRIVATE_JSON_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

export function privateJsonResponse<T>(body: T, status = 200): Response {
  return Response.json(body, {
    status,
    headers: PRIVATE_JSON_HEADERS,
  });
}
