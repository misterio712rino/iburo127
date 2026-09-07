import "server-only";

import { readYandexPostboxConfig } from "@/server/config/production";
import {
  YandexPostboxEmailDelivery,
  type TransactionalEmailDelivery,
} from "@/server/email/yandex-postbox";

let delivery: TransactionalEmailDelivery | undefined;

export function getTransactionalEmailDelivery(): TransactionalEmailDelivery {
  delivery ??= new YandexPostboxEmailDelivery(readYandexPostboxConfig());
  return delivery;
}
