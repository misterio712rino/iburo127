export function isVercelBlobDeleteSuccessStatus(status: number): boolean {
  return (status >= 200 && status < 300) || status === 404;
}
