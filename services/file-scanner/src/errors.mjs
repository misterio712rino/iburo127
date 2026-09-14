export class SafeScannerError extends Error {
  constructor(category, status = 503) {
    super(category);
    this.name = "SafeScannerError";
    this.category = category;
    this.status = status;
  }
}

export function toSafeScannerError(error, category = "INTERNAL_FAILURE") {
  if (error instanceof SafeScannerError) return error;
  return new SafeScannerError(category, 503);
}
