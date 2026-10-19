# Stripe Checkout Session recovery runbook

## Scope and trigger

A Checkout attempt is blocked with `COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED` when the order has no persisted Stripe Session ID and its recorded create-attempt is at least 20 hours old. This is a fail-closed stop: do not retry checkout, clear the timestamp, change the order, or create a new order just to bypass it.

This runbook is for an authorized operator using the same Stripe account and mode (test or live) that the application used. It is a read-only investigation until a separately reviewed recovery action exists. Never paste or log Stripe secrets, customer email, full request payloads, or signed checkout URLs.

## 1. Inspect the order in the approved database

Only use an explicitly approved target. Confirm the target using the existing staging guardrails; do not use this query against production as an ad-hoc repair tool. Bind PostgreSQL parameter `$1` to the exact `publicCheckoutId`; do not interpolate it into SQL. Run read-only and roll back:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT
  "id",
  "publicCheckoutId",
  "clientCaseId",
  "planId",
  "amountMinor",
  "currency",
  "status",
  "stripeCheckoutSessionId",
  "stripeCheckoutSessionCreateStartedAt",
  "paidAt",
  "createdAt",
  "updatedAt"
FROM "CommerceOrder"
WHERE "publicCheckoutId" = $1;

ROLLBACK;
```

There must be exactly one order. Record the order's attempt timestamp, public checkout ID, expected amount/currency, status and case ID in the restricted incident record. Do not include customer email.

Stop if the order is not `PENDING_PAYMENT`, already has a Session ID, has a payment/refund event, or the database target/history is not approved. Resolve the payment state through the normal webhook/audit process first.

## 2. Search Stripe without creating or mutating anything

Use Stripe's read-only Checkout Sessions list API for the exact account and mode used by this order. Bound the search by the persisted attempt time (include a small clock-skew margin before it) and the current time. Follow every page until `has_more` is false; use the API's supported `created` time bounds. The list endpoint does not expose a `client_reference_id` or metadata filter, so filter returned sessions locally.

For each result, compare the exact `client_reference_id` with the order's `publicCheckoutId`, and verify metadata `publicCheckoutId` and `clientCaseId`, `mode=payment`, amount, currency, and the expected Stripe account/mode. Retrieve any candidate by its Session ID and re-check those fields from the retrieved object. Do not print customer details or the hosted Checkout URL.

The integration sets `client_reference_id` to `publicCheckoutId` and puts both `publicCheckoutId` and `clientCaseId` in Session metadata. An exact match plus amount/currency/mode is required; timestamps or email alone are not identity evidence.

Stop and escalate without changing the order if:
- more than one candidate matches;
- one or more fields disagree;
- pagination is incomplete, the time range is uncertain, or the account/mode cannot be confirmed;
- a candidate is `complete`, or any payment/refund event exists;
- the single matching Session is expired.

For one matching `open` Session, do not create another Session. A MANAGER with the production staff-MFA session may use `POST /api/platform/commerce/checkout-recovery` with exactly `publicCheckoutId`, `stripeCheckoutSessionId` and an opaque `evidenceReference` (incident/ticket ID). The endpoint retrieves the Session again, checks its status, mode, reference, metadata, amount and currency, then attaches it with the operator and evidence reference in one serializable database transaction. It returns no Checkout URL. Do not manually update the database.

If a complete bounded scan returns no match, that is evidence for review, not permission to retry. Preserve the attempt marker and escalate for a second-person review of the Stripe account, exact time range, pagination and webhook/event state. Do not conclude “no Session was created” from a partial scan or Dashboard search.

## 3. MVP policy: no automatic reopening

The controlled operation only restores an already-existing, verified `open` Session. For the MVP, an order remains blocked when a complete Stripe search finds no Session; support escalates it for manual provider review. There is no operation that resets the attempt marker or reopens checkout. Do not clear `stripeCheckoutSessionCreateStartedAt`, attach an ID by SQL, or replay Checkout manually.

Reopening requires a separately reviewed, auditable application operation that:
1. re-reads and locks/revalidates the pending order and its payment/event state in a transaction;
2. confirms a complete Stripe search found no Session and no payment exists, with a second operator approving the evidence;
3. records the operator, reason and evidence reference;
4. sets a new bounded attempt marker atomically, then lets the normal Checkout service create the Session with its normal idempotency key;
5. fails closed on any concurrent order/payment/event change.

Until that operation is implemented and tested against an approved staging PostgreSQL database, an ambiguous order stays blocked and support handles it manually with the provider. Never repair by issuing a second charge or by changing order/payment status directly.

## References

- [List all Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/list): supported list filters include time bounds and pagination; it does not provide a filter for our local reference/metadata values.
- [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create): `client_reference_id` is intended to help reconcile a Session with an internal system.
- [Idempotent requests](https://docs.stripe.com/api/idempotent_requests): Stripe may prune keys after they are at least 24 hours old; this application stops automatic retries at 20 hours.

This document defines a read-only investigation and a future controlled repair requirement. It does not claim that reconciliation or PostgreSQL recovery has been executed.
