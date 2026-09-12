# Notification delivery outbox

## Purpose

System notifications remain durable in PostgreSQL and may optionally enqueue an external email delivery in the same database transaction. The external provider is Yandex Cloud Postbox.

This design prevents duplicate notification/outbox rows when the application retries the same logical event, while avoiding any claim of impossible exactly-once provider delivery.

## Idempotency contract

Any system notification requesting `EMAIL` delivery must include a stable `dedupeKey` that identifies the logical event, for example:

```text
task:<task-id>:assigned:v1
```

The database enforces uniqueness on `(userId, dedupeKey)`. Repeating the same request returns the existing notification only when the immutable payload and requested channels match. Reusing a dedupe key with different case/type/title/body/channel data fails with `NOTIFICATION_DEDUPE_CONFLICT`.

In-app notifications that do not request external delivery may continue to omit `dedupeKey`.

## Durable delivery state

`NotificationDelivery` is created transactionally with its `Notification` row and tracks:

- channel;
- `PENDING / PROCESSING / SENT / DEAD` status;
- attempt count;
- next retry time;
- lease token and expiry;
- sanitized last error code;
- optional provider message id;
- sent timestamp.

Only one delivery row is allowed per `(notificationId, channel)`.

## Worker concurrency

The maintenance worker claims due rows with an optimistic compare-and-swap lease:

1. choose a due `PENDING` row or expired `PROCESSING` lease;
2. atomically update it to `PROCESSING` with a new random lease token and increment `attemptCount`;
3. only the holder of that exact lease token may mark the row `SENT`, reschedule it, or mark it `DEAD`.

This prevents two healthy workers from intentionally sending the same current lease.

Default worker policy in the route is:

```text
batch size: 10
lease: 2 minutes
maximum attempts: 6
retry delays: 1m, 5m, 15m, 1h, 6h
```

Missing/invalid recipient email is terminal and does not call the provider. Provider/network failures are stored only as bounded non-PII codes.

## Delivery guarantee

The design is **at-least-once**, not exactly-once.

Yandex Cloud Postbox `SendEmail` does not expose a client-provided idempotency token. If Postbox accepts a message and the application crashes before PostgreSQL records `SENT`, the lease can later expire and the message can be sent again. The outbox/lease model makes this window narrow and observable but cannot eliminate it without provider-side idempotency.

Do not describe this implementation as exactly-once email delivery.

## Maintenance endpoint

The worker is exposed only through:

```text
POST /api/internal/maintenance/notification-deliveries
Authorization: Bearer <IB_MAINTENANCE_SECRET>
```

It reuses the timing-safe maintenance authorization boundary and returns `Cache-Control: no-store`. It never accepts recipient, notification id, message content, channel, or provider credentials from the request body.

The production/staging scheduler itself is still an infrastructure activation task. Repository CI does not prove that a scheduler has been configured.

## Database migration boundary

The current audit branch has no authoritative Prisma migration history yet. This pass updates `prisma/schema.prisma` and the read-only staging schema verifier only.

It deliberately does **not**:

- create an assumed baseline migration;
- run `prisma migrate dev`;
- run `prisma db push`;
- apply DDL to staging;
- apply DDL to production.

Before activation, follow `docs/DATABASE_MUTATION_SAFETY.md`: identify the authoritative database, verify backup/rollback, inspect the baseline, establish/review migration history, review SQL, and only then use the guarded staging deployment path.

Until that reviewed migration is applied to staging, the notification email worker is code-complete foundation only and must not be called runtime-ready.

## Staging acceptance

After the reviewed schema migration exists and is applied to staging:

1. run `npm run db:verify:staging` and confirm `NotificationDelivery` plus its enums exist;
2. create controlled staging notification fixtures with stable dedupe keys;
3. verify repeated creation produces one Notification and one EMAIL delivery row;
4. invoke the maintenance endpoint with staging credentials;
5. verify successful transition `PENDING -> PROCESSING -> SENT`;
6. force a provider/network failure and verify backoff without raw provider/recipient data in logs;
7. verify an expired lease is reclaimable and a live lease is not;
8. verify a missing recipient becomes `DEAD` without provider traffic;
9. verify real Yandex delivery separately with the official Postbox staging simulator procedure;
10. document scheduler cadence, alerting and rollback before production approval.
