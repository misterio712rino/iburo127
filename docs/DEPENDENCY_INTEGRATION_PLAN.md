# iБюро — Controlled Dependency Integration Plan

This document fixes the intended dependency set for the remaining concrete auth/storage adapters. It does not authorize automatic production migrations.

## Better Auth

Planned runtime dependency:

```text
better-auth
```

Purpose:
- create the real Better Auth server instance;
- expose the Next.js auth route handler;
- call `auth.api.getSession({ headers })` through the existing iБюро session bridge;
- enable the 2FA plugin for TOTP/backup codes.

Do not duplicate legal-domain roles or case ownership inside Better Auth. The verified Better Auth user ID remains an external subject and must resolve through `AuthIdentity` to internal `User.id`.

## Yandex Object Storage

Planned runtime dependencies:

```text
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

Purpose:
- use Yandex Object Storage through its S3-compatible endpoint;
- create short-lived signed PUT/GET URLs;
- delete private objects through the server-side S3 client.

Runtime configuration is already defined by `readYandexObjectStorageConfig`:

- endpoint: `https://storage.yandexcloud.net`;
- region: `ru-central1`;
- private bucket from environment;
- service-account static access key from environment.

The AWS SDK binding must implement `YandexObjectStorageSigner`; domain/files code must continue to depend on `PrivateObjectStorage`, not AWS SDK types.

## Controlled installation procedure

Perform this only in the audit/release branch after pulling the exact current branch head:

```text
npm install better-auth @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Then review both `package.json` and `package-lock.json`. Do not use `npm audit fix` or `npm audit fix --force` as part of this change.

Required validation after the dependency commit:

```text
npm run db:validate
npm run db:generate
npm run test:foundation
npx tsc --noEmit
npm run lint
npm run build
```

## Better Auth schema rule

After the package is installed, generate the Better Auth schema/migration representation and review it together with the existing Prisma database-baseline plan. Do not run provider auto-migrations against production.

## Storage security rule

The concrete AWS SDK adapter must preserve all existing policies:

- private bucket;
- no public object URL as an application data path;
- 30–900 second signed URL TTL;
- opaque object keys;
- no PII in object names;
- authorization performed before URL issuance;
- credentials server-only and never serialized to the browser.
