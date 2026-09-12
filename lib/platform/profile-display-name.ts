function swapFirstAndLastName(value: string) {
  const parts = value.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length !== 3) return parts.join(" ");
  return [parts[1], parts[0], parts[2]].join(" ");
}

export function formatProfileDisplayName(value: string) {
  return swapFirstAndLastName(value);
}

export function formatProfileNameForStorage(value: string) {
  return swapFirstAndLastName(value);
}
