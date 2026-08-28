import "dotenv/config";

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "YANDEX_STORAGE_BUCKET",
  "YANDEX_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_SECRET_ACCESS_KEY",
] as const;

function fail(message: string): never {
  console.error(`STAGING_READINESS_FAIL: ${message}`);
  process.exit(1);
}

for (const name of REQUIRED_ENV) {
  if (!process.env[name]?.trim()) fail(`missing ${name}`);
}

const authUrl = new URL(process.env.BETTER_AUTH_URL!);
if (authUrl.protocol !== "https:" && authUrl.hostname !== "localhost") {
  fail("BETTER_AUTH_URL must use HTTPS outside localhost");
}

if (process.env.BETTER_AUTH_SECRET!.trim().length < 32) {
  fail("BETTER_AUTH_SECRET must be at least 32 characters");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

try {
  const result = await pool.query<{
    database_name: string;
    database_user: string;
    postgres_version: string;
  }>(
    "select current_database() as database_name, current_user as database_user, version() as postgres_version",
  );
  const row = result.rows[0];
  if (!row) fail("PostgreSQL health query returned no rows");
  console.log(`PostgreSQL: reachable (${row.database_name}, user=${row.database_user})`);
  console.log(`PostgreSQL version: ${row.postgres_version.split(",")[0]}`);
} finally {
  await pool.end();
}

const s3 = new S3Client({
  endpoint: "https://storage.yandexcloud.net",
  region: "ru-central1",
  credentials: {
    accessKeyId: process.env.YANDEX_STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.YANDEX_STORAGE_SECRET_ACCESS_KEY!,
  },
});

await s3.send(new HeadBucketCommand({ Bucket: process.env.YANDEX_STORAGE_BUCKET! }));
console.log(`Yandex Object Storage: private bucket credentials accepted (${process.env.YANDEX_STORAGE_BUCKET})`);
console.log("Better Auth runtime config: present and structurally valid");
console.log("STAGING_READINESS_PASS");
