import { isIP } from "node:net";

function parseIpv4(value) {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => (/^(0|[1-9]\d{0,2})$/.test(part) ? Number(part) : -1));
  return bytes.every((part) => part >= 0 && part <= 255) ? bytes : null;
}

function isPublicIpv4(value) {
  const bytes = parseIpv4(value);
  if (!bytes) return false;
  const [a, b] = bytes;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 192 && b === 88 && bytes[2] === 99) return false;
  if (a === 192 && b === 0 && bytes[2] === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && bytes[2] === 100) return false;
  if (a === 203 && b === 0 && bytes[2] === 113) return false;
  return true;
}

function parseIpv6(value) {
  if (value.includes("%")) return null;
  let normalized = value.toLowerCase();
  const ipv4Index = normalized.lastIndexOf(":");
  const ipv4Tail = normalized.slice(ipv4Index + 1);
  if (ipv4Tail.includes(".")) {
    const ipv4 = parseIpv4(ipv4Tail);
    if (!ipv4) return null;
    normalized = `${normalized.slice(0, ipv4Index)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const parts = [...left, ...Array(missing).fill("0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

function isPublicIpv6(value) {
  const words = parseIpv6(value);
  if (!words) return false;
  const mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (mapped) {
    return isPublicIpv4(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  if ((words[0] & 0xe000) !== 0x2000) return false;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false;
  if (words[0] === 0x2001 && words[1] === 0x0002) return false;
  if (words[0] === 0x2001 && (words[1] & 0xfff0) === 0x0010) return false;
  if (words[0] === 0x2001 && (words[1] & 0xfff0) === 0x0020) return false;
  if (words[0] === 0x2001 && words[1] === 0) return false;
  if (words[0] === 0x2002) return false;
  return true;
}

export function isPublicRoutableAddress(address) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}
