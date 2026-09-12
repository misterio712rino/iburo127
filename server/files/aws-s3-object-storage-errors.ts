export function isAwsS3NotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const metadata = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata;
  return metadata?.httpStatusCode === 404;
}
