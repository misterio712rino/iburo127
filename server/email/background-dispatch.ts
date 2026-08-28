import type {
  TransactionalEmailDelivery,
  TransactionalEmailInput,
} from "@/server/email/yandex-postbox-core";

export type EmailBackgroundWork = () => Promise<void>;
export type EmailBackgroundScheduler = (work: EmailBackgroundWork) => void;

export function createNonBlockingEmailDispatcher(
  getDelivery: () => TransactionalEmailDelivery,
  schedule: EmailBackgroundScheduler,
) {
  return function dispatch(input: TransactionalEmailInput) {
    try {
      const delivery = getDelivery();
      schedule(async () => {
        try {
          await delivery.send(input);
        } catch {
          // Provider/network details and message payloads must not escape to runtime logs.
        }
      });
    } catch {
      // Authentication responses must not reveal provider configuration or scheduling state.
    }
  };
}
