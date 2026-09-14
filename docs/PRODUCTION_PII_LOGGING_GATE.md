# iБюро — Production PII / logging gate

Production runtime code must not write arbitrary application objects directly to process/browser logs. Bankruptcy workflows can carry passport, financial, questionnaire, document, authentication and file metadata, so an unreviewed `console.*` call is treated as a release risk.

Run locally:

```bash
npm run check:runtime-logging
```

The command is also a blocking GitHub Actions CI step.

## Scope

The gate recursively inspects runtime source under:

- `app/`;
- `server/`;
- `components/`;
- `lib/`;
- root middleware/proxy/instrumentation entrypoints when present.

It rejects direct calls to:

- `console.log/info/warn/error/debug/trace/dir/table`;
- `process.stdout.write`;
- `process.stderr.write`.

The CI output reports only file path, line number and rule identifier. It intentionally does **not** echo the matched source line, because the source expression itself could contain a secret or PII-bearing field name/value.

Build/test/admin scripts are outside the runtime scan and may print controlled status messages. They still must never print cookies, passwords, signed URLs, object keys, tokens, questionnaire answers, document bodies or user PII.

## Current production policy

Until a centralized production observability provider is selected, iБюро runtime application code is intentionally prohibited from direct application logging.

In particular, do not log raw:

- `Request`, headers, cookies or session objects;
- Better Auth responses/tokens/backup codes;
- `Error` objects or stack traces whose messages may include payload values;
- questionnaire answers;
- generated document content;
- file names when they may contain personal information;
- Yandex Object Storage `objectKey` or signed upload/download URLs;
- database rows containing user or case data.

Framework/platform infrastructure logs are outside this source-code gate and must be reviewed separately in the eventual hosting environment.

## Future structured logger

A production logger may be introduced only as a reviewed boundary. It should accept controlled event codes and an explicit metadata allowlist, redact unknown keys by default, avoid raw error/request serialization, and separate operational correlation identifiers from business payloads.

If such a logger is introduced, update this gate deliberately rather than adding ad-hoc exceptions at call sites.

## What this gate does not prove

This is a static source guard, not a complete privacy audit. It does not inspect third-party package internals, hosting-provider logs, PostgreSQL server logs, reverse-proxy logs, browser extensions, external providers or runtime crash dumps. Those remain release-review items.
