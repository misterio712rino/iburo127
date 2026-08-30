import { signAwsV4Request } from "@/server/email/aws-sigv4";

export const EMAIL_DELIVERY_FAILED = "EMAIL_DELIVERY_FAILED";

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type TransactionalEmailDelivery = {
  send(input: TransactionalEmailInput): Promise<void>;
};

export type YandexPostboxTransportConfig = {
  fromEmail: string;
  region: "ru-central1";
  endpoint: "https://postbox.cloud.yandex.net";
  host: "postbox.cloud.yandex.net";
  accessKeyId: string;
  secretAccessKey: string;
  requestTimeoutMs: number;
};

export type YandexPostboxFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

function normalizeEmailAddress(value: string, failureCode: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > 254 ||
    /[\r\n\0]/.test(trimmed) ||
    !/^[^\s@]+@[^\s@]+$/.test(trimmed)
  ) {
    throw new Error(`${EMAIL_DELIVERY_FAILED}:${failureCode}`);
  }
  return trimmed;
}

function assertSafeMessage(input: TransactionalEmailInput) {
  const subject = input.subject.trim();
  const text = input.text.trim();
  if (!subject || subject.length > 180 || /[\r\n\0]/.test(subject)) {
    throw new Error(`${EMAIL_DELIVERY_FAILED}:INVALID_SUBJECT`);
  }
  if (!text || text.length > 20_000 || /\0/.test(text)) {
    throw new Error(`${EMAIL_DELIVERY_FAILED}:INVALID_BODY`);
  }
  return {
    to: normalizeEmailAddress(input.to, "INVALID_EMAIL"),
    subject,
    text,
  };
}

function assertTransportConfig(config: YandexPostboxTransportConfig) {
  const exactProviderTarget =
    config.region === "ru-central1" &&
    config.endpoint === "https://postbox.cloud.yandex.net" &&
    config.host === "postbox.cloud.yandex.net";
  const accessKeyId = config.accessKeyId.trim();
  const secretAccessKey = config.secretAccessKey.trim();
  const validCredentials =
    Boolean(accessKeyId) &&
    Boolean(secretAccessKey) &&
    !/[\r\n\0]/.test(accessKeyId) &&
    !/[\r\n\0]/.test(secretAccessKey);
  const validTimeout =
    Number.isInteger(config.requestTimeoutMs) &&
    config.requestTimeoutMs >= 1 &&
    config.requestTimeoutMs <= 60_000;

  if (!exactProviderTarget || !validCredentials || !validTimeout) {
    throw new Error(`${EMAIL_DELIVERY_FAILED}:INVALID_CONFIG`);
  }

  let fromEmail: string;
  try {
    fromEmail = normalizeEmailAddress(config.fromEmail, "INVALID_CONFIG");
  } catch {
    throw new Error(`${EMAIL_DELIVERY_FAILED}:INVALID_CONFIG`);
  }

  return {
    ...config,
    fromEmail,
    accessKeyId,
    secretAccessKey,
  };
}

export async function sendYandexPostboxEmail(
  configInput: YandexPostboxTransportConfig,
  input: TransactionalEmailInput,
  fetchImpl: YandexPostboxFetch = fetch,
) {
  const config = assertTransportConfig(configInput);
  const message = assertSafeMessage(input);
  const payload = JSON.stringify({
    FromEmailAddress: config.fromEmail,
    Destination: {
      ToAddresses: [message.to],
    },
    Content: {
      Simple: {
        Subject: {
          Data: message.subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: message.text,
            Charset: "UTF-8",
          },
        },
      },
    },
  });

  const signed = signAwsV4Request({
    method: "POST",
    canonicalPath: "/v2/email/outbound-emails",
    headers: {
      "content-type": "application/json",
      host: config.host,
    },
    payload,
    region: config.region,
    service: "ses",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${config.endpoint}/v2/email/outbound-emails`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-date": signed.amzDate,
        authorization: signed.authorization,
      },
      body: payload,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new Error(`${EMAIL_DELIVERY_FAILED}:TIMEOUT`);
    }
    throw new Error(`${EMAIL_DELIVERY_FAILED}:NETWORK`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`${EMAIL_DELIVERY_FAILED}:HTTP_${response.status}`);
  }
}
