import assert from "node:assert/strict";
import { createNonBlockingEmailDispatcher } from "@/server/email/background-dispatch";
import type { TransactionalEmailDelivery } from "@/server/email/yandex-postbox-core";

const scheduled: Array<() => Promise<void>> = [];
const sent: string[] = [];
const delivery: TransactionalEmailDelivery = {
  async send(input) {
    sent.push(input.to);
  },
};

const dispatch = createNonBlockingEmailDispatcher(
  () => delivery,
  (work) => {
    scheduled.push(work);
  },
);

dispatch({
  to: "recipient@example.com",
  subject: "subject",
  text: "body",
});

assert.deepEqual(sent, []);
assert.equal(scheduled.length, 1);
await scheduled[0]!();
assert.deepEqual(sent, ["recipient@example.com"]);

const rejectedDelivery: TransactionalEmailDelivery = {
  async send() {
    throw new Error("provider details must be swallowed");
  },
};
let rejectedWork: (() => Promise<void>) | undefined;
const rejectedDispatch = createNonBlockingEmailDispatcher(
  () => rejectedDelivery,
  (work) => {
    rejectedWork = work;
  },
);
assert.doesNotThrow(() =>
  rejectedDispatch({ to: "recipient@example.com", subject: "subject", text: "body" }),
);
await assert.doesNotReject(async () => rejectedWork?.());

const providerFailureDispatch = createNonBlockingEmailDispatcher(
  () => {
    throw new Error("configuration details must be swallowed");
  },
  () => {
    throw new Error("scheduler should not be reached");
  },
);
assert.doesNotThrow(() =>
  providerFailureDispatch({ to: "recipient@example.com", subject: "subject", text: "body" }),
);

const schedulerFailureDispatch = createNonBlockingEmailDispatcher(
  () => delivery,
  () => {
    throw new Error("request context details must be swallowed");
  },
);
assert.doesNotThrow(() =>
  schedulerFailureDispatch({ to: "recipient@example.com", subject: "subject", text: "body" }),
);

console.log("AUTH_EMAIL_BACKGROUND_DISPATCH_TEST_PASS");
