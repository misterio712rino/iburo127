import "server-only";

import type { YandexPostboxConfig } from "@/server/config/production";
import {
  sendYandexPostboxEmail,
  type TransactionalEmailDelivery,
  type TransactionalEmailInput,
} from "@/server/email/yandex-postbox-core";

export { EMAIL_DELIVERY_FAILED } from "@/server/email/yandex-postbox-core";
export type {
  TransactionalEmailDelivery,
  TransactionalEmailInput,
} from "@/server/email/yandex-postbox-core";

export class YandexPostboxEmailDelivery implements TransactionalEmailDelivery {
  constructor(private readonly config: YandexPostboxConfig) {}

  async send(input: TransactionalEmailInput) {
    await sendYandexPostboxEmail(this.config, input);
  }
}
