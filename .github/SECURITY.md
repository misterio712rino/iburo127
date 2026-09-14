# Security Policy

## Reporting a vulnerability

Do not disclose a suspected vulnerability, credential, token, private key, personal data, client document, or production-system detail in a public GitHub Issue, Discussion, pull request, commit message, or other public repository surface.

Use a private communication channel with the repository owner for security reports. If GitHub Private Vulnerability Reporting is enabled for this repository, prefer that channel. Otherwise, contact the repository owner privately through an already established trusted channel.

A useful report should include only the minimum information necessary to reproduce and assess the issue:

- affected component or route;
- expected versus observed behavior;
- reproducible steps using non-production data;
- security impact and preconditions;
- relevant logs or screenshots with credentials and personal data redacted.

Do not include live credentials or production personal data in the report. If a secret may have been exposed, identify the secret by provider and purpose without pasting its value.

## Safe testing rules

Security research must not intentionally access, modify, destroy, export, or disclose data belonging to real iБюро clients, employees, partners, or production systems.

Do not:

- perform destructive or high-volume testing against production;
- run credential stuffing, password spraying, or denial-of-service tests;
- upload malware to production or shared infrastructure;
- attempt social engineering or phishing;
- bypass authorization to view another user's case, files, questionnaire answers, or activity;
- mutate production PostgreSQL, storage, Bitrix24, email, AI-provider, DNS, or deployment configuration;
- retain personal data or credentials discovered accidentally.

Use dedicated non-production test data and staging infrastructure when available.

## Sensitive data handling

The project treats the following as sensitive and unsuitable for public disclosure:

- authentication secrets and session material;
- database credentials and connection URLs containing passwords;
- object-storage access keys;
- email-provider credentials;
- OpenAI/API credentials;
- Bitrix24 webhook secrets;
- maintenance/scanner secrets;
- client names, contacts, passport data, financial information, legal documents, case files, and other personal data.

Any accidentally disclosed credential must be treated as compromised and rotated through the relevant provider's trusted administrative interface. Rotation is an external operational action and must not be simulated by changing only repository text.

## Repository security controls

The repository CI includes fail-closed controls for tracked secret exposure, GitHub Actions pinning and workflow privileges, dependency install scripts, dependency audit policy, runtime PII logging, Prisma production isolation, TypeScript, strict linting, foundation tests, and production build validation.

These controls reduce risk but do not replace GitHub repository governance, staging validation, production access controls, credential rotation, backups, monitoring, or incident response.

## Release security

Production release approval requires the exact candidate commit to satisfy the repository release-security contract documented in `docs/GITHUB_REPOSITORY_SECURITY.md`.

A green historical CI run for a different commit is not sufficient evidence for release readiness.
