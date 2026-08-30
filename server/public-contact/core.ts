export const PUBLIC_CONTACT_INVALID = "PUBLIC_CONTACT_INVALID";

export type PublicContactRequest = Readonly<{
  name: string;
  phone: string;
  email: string;
  message: string;
  consent: true;
  spam: boolean;
}>;

const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 32;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HONEYPOT_LENGTH = 200;

function fail(code: string): never {
  throw new Error(`${PUBLIC_CONTACT_INVALID}:${code}`);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("BODY");
  }
  return value as Record<string, unknown>;
}

function requireString(
  value: unknown,
  code: string,
  maxLength: number,
  { allowEmpty = false, multiline = false } = {},
): string {
  if (typeof value !== "string") fail(code);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) fail(code);

  const forbidden = multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/ : /[\u0000-\u001F\u007F]/;
  if (forbidden.test(normalized)) fail(code);
  return normalized;
}

function normalizePhone(value: unknown): string {
  const phone = requireString(value, "PHONE", MAX_PHONE_LENGTH, { allowEmpty: true });
  if (!phone) return "";
  if (!/^[+0-9()\-\s]{7,32}$/.test(phone)) fail("PHONE");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) fail("PHONE");
  return phone;
}

function normalizeEmail(value: unknown): string {
  const email = requireString(value, "EMAIL", MAX_EMAIL_LENGTH, { allowEmpty: true }).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("EMAIL");
  return email;
}

export function parsePublicContactRequest(value: unknown): PublicContactRequest {
  const record = requireRecord(value);
  const name = requireString(record.name, "NAME", MAX_NAME_LENGTH);
  const phone = normalizePhone(record.phone);
  const email = normalizeEmail(record.email);
  const message = requireString(record.message, "MESSAGE", MAX_MESSAGE_LENGTH, {
    allowEmpty: true,
    multiline: true,
  });
  const website = requireString(record.website ?? "", "HONEYPOT", MAX_HONEYPOT_LENGTH, {
    allowEmpty: true,
  });

  if (!phone && !email) fail("CONTACT_METHOD");
  if (record.consent !== true) fail("CONSENT");

  return Object.freeze({
    name,
    phone,
    email,
    message,
    consent: true,
    spam: Boolean(website),
  });
}

export function formatPublicContactEmail(input: PublicContactRequest): string {
  if (input.spam) fail("SPAM_MESSAGE");
  return [
    "Новая заявка с публичной формы iБюро.",
    "",
    `Имя: ${input.name}`,
    `Телефон: ${input.phone || "не указан"}`,
    `Email: ${input.email || "не указан"}`,
    "",
    "Сообщение:",
    input.message || "не указано",
    "",
    "Согласие на обработку персональных данных: получено.",
  ].join("\n");
}
