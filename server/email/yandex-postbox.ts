import "server-only";

import type { YandexPostboxConfig } from "@/server/config/production";
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

function assertSafeEmailAddress(value: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > 254 ||
    /[\r\n\0]/.test(trimmed) ||
    !/^[^\s@]+@[^\s@]+$/.test(trimmed)
  ) {
    throw new Error(`${EMAIL_DELIVERY_FAILED}:INVALID_EMAIL`);
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
    to: assertSafeEmailAddress(input.to),
    subject,
    text,
  };
}

export class YandexPostboxEmailDelivery implements TransactionalEmailDelivery {
  constructor(private readonly config: YandexPostboxConfig) {}

  async send(input: TransactionalEmailInput) {
    const message = assertSafeMessage(input);
    const payload = JSON.stringify({
      FromEmailAddress: this.config.fromEmail,
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
        host: this.config.host,
      },
      payload,
      region: this.config.region,
      service: "ses",
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
    });

    const response = await fetch(`${this.config.endpoint}/v2/email/outbound-emails`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-date": signed.amzDate,
        authorization: signed.authorization,
      },
      body: payload,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${EMAIL_DELIVERY_FAILED}:HTTP_${response.status}`);
    }
  }
}
