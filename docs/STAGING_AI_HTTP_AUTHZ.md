# Staging AI HTTP authorization verification

Status: verifier implemented. It must not be described as executed until staging fixture sessions and cases are configured and the command is actually run.

Command:

`npm run check:staging:http-ai-authz`

## Purpose

This verifier exercises the real staging HTTP routes while intentionally avoiding any model-provider request. It proves the server trust boundary around the AI client endpoint, not model quality.

Required staging fixtures:

- one authenticated CLIENT session;
- one authenticated LAWYER session;
- one authenticated MANAGER session;
- two different cases owned by the CLIENT fixture:
  - `IB_STAGING_CLIENT_AI_CASE_NUMBER`: plan includes `AI_ASSISTANT`;
  - `IB_STAGING_CLIENT_NO_AI_CASE_NUMBER`: plan does not include `AI_ASSISTANT`;
- `IB_STAGING_LAWYER_CASE_NUMBER`: a different case not owned by the CLIENT fixture and visible to the MANAGER fixture.

Cookies must be short-lived staging-only Better Auth sessions. Never use production cookies.

## Assertions

The verifier checks:

1. unauthenticated AI state request returns `401 UNAUTHENTICATED`;
2. LAWYER cannot use the client AI endpoint and receives `403 FORBIDDEN`;
3. MANAGER cannot use the client AI endpoint and receives `403 FORBIDDEN`;
4. CLIENT cannot access the other fixture case and receives `404 NOT_FOUND`;
5. the CLIENT AI-enabled case reports `enabled: true`;
6. the CLIENT non-AI case reports `enabled: false`;
7. POST to the non-AI case returns `403 AI_FEATURE_NOT_AVAILABLE`.

The final POST is deliberately sent only to the non-entitled case. In the domain service, feature entitlement is checked before rate-limit reservation and before `AiModelGateway.reply()`, so this verifier is designed to execute zero provider requests and create no AI request reservation.

Every tested private response must also contain `Cache-Control: no-store`.

## What this verifier does not prove

It does not:

- call OpenAI;
- verify model output or legal guardrails against a live model;
- consume the AI rate limit on the enabled case;
- validate concurrency of PostgreSQL advisory-lock reservations;
- mutate production data;
- validate production credentials.

Those remain separate staging acceptance steps. The guarded provider smoke check remains `npm run check:staging:ai-provider` and must use the dedicated staging key fingerprint/confirmation guard.
