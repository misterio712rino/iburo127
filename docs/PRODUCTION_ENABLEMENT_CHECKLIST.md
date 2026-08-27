# iБюро — Production Enablement Checklist

This checklist defines the conditions for switching any platform workflow from investor-demo state to real client data.

## Global gates

- [ ] Authoritative PostgreSQL cluster confirmed and reachable from the deployment environment.
- [ ] Current database schema inspected and backed up.
- [ ] Prisma migration baseline established without destructive drift.
- [ ] Concrete authentication provider configured.
- [ ] Trusted server-side session reader implemented.
- [ ] External `(provider, subject)` identities mapped to internal `User.id` through `AuthIdentity`.
- [ ] Account enrollment, recovery and MFA policy approved and implemented.
- [ ] No production route trusts `DemoIdentityProvider`, localStorage identity, browser role or browser user ID.
- [ ] CI is green on the exact release commit.
- [ ] Full production build is green on the exact release commit.
- [ ] Security review confirms case-scoped authorization for every real-data endpoint.
- [ ] Error responses do not expose sensitive questionnaire/document/user data.
- [ ] Production logs do not contain questionnaire answers or document contents.

## Questionnaire gates

Repository/server foundation is present, but activation requires:

- [ ] `CaseQuestionnaire` migration SQL reviewed.
- [ ] Migration applied to a non-production environment first.
- [ ] Real `SessionProvider` wired into Next.js route handlers/server actions.
- [ ] Client route uses authenticated `ClientCase.id`, not demo identity IDs.
- [ ] Optimistic concurrency conflict (`409`) is handled in UI.
- [ ] Empty/loading/retry states verified.
- [ ] Cross-role tests verify CLIENT owner write, LAWYER assigned read, MANAGER read, unauthorized denial.
- [ ] Questionnaire schema-version upgrade strategy verified before changing questionnaire fields in production.

## Practicum gates

- [ ] Persistence model reviewed.
- [ ] Case-scoped progress repository/service implemented.
- [ ] Demo service swapped only after parity validation.
- [ ] Server derives actor and case access.

## Tasks gates

- [ ] Task ownership/assignment semantics approved.
- [ ] Task history/audit model approved.
- [ ] Lawyer/manager permissions tested against real assignments.
- [ ] Browser task state no longer authoritative.

## Documents gates

- [ ] Document lifecycle/status model approved.
- [ ] File/object storage provider selected.
- [ ] Signed/private download strategy implemented.
- [ ] Review actions are server-authorized and audited.
- [ ] No generated document is exposed by guessable public URL.

## Release safety

- Never run `prisma db push` against production as a substitute for reviewed migrations.
- Never run `npm audit fix --force` automatically on the release branch.
- Never merge `audit/production-readiness` into `main` until the exact diff and CI are reviewed.
- Never point production traffic at an audit deployment until authentication and the database baseline are confirmed.
- Keep the investor demo isolated from production authorization even if both experiences coexist in one codebase.
