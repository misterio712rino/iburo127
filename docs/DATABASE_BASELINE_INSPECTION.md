# iБюро — безопасная проверка baseline PostgreSQL

Перед созданием первой migration history для production/staging необходимо сначала зафиксировать фактическое состояние существующей PostgreSQL базы. Нельзя считать текущий `prisma/schema.prisma` доказательством того, что реальная база уже соответствует этой схеме.

## Обязательные staging guards

Обе baseline-команды являются **staging-only** и до открытия PostgreSQL connection требуют:

```text
DATABASE_URL=...
IB_DB_TARGET=staging
IB_STAGING_DATABASE_HOST=<exact staging host>
IB_STAGING_DATABASE_NAME=<exact staging database>
IB_STAGING_DATABASE_USER=<exact staging user>
IB_STAGING_BETTER_AUTH_SCHEMA=<exact Better Auth schema, normally public>
```

`DATABASE_URL` должен кодировать те же host/database/user, что и три `IB_STAGING_DATABASE_*` значения. Несовпадение блокирует подключение.

Нельзя подменять эти значения production target данными только ради прохождения guard.

## Шаг 1 — public-safe summary

Сначала выполнить:

```bash
npm run db:inspect:baseline:summary
```

Команда открывает:

```sql
BEGIN READ ONLY;
```

и собирает только агрегированное состояние:

- общее количество пользовательских base tables;
- сколько обязательных domain tables/enums iБюро найдено;
- сколько Better Auth tables найдено;
- существует ли `public._prisma_migrations`;
- количество успешно применённых и незавершённых Prisma migrations;
- безопасную классификацию следующего шага.

Summary не выводит `DATABASE_URL`, host, database/user values, имена фактически найденных произвольных таблиц, columns, indexes, constraints или defaults.

### Классификация

- `A_EMPTY_DATABASE` — пользовательских tables нет. Можно проектировать настоящую initial domain migration, но сначала всё равно нужен backup/snapshot policy и SQL review.
- `B_EXISTING_DOMAIN_SCHEMA` — найдены domain objects без подтверждённой Prisma history. Нельзя делать blind init; нужен полный structural baseline и reconciliation.
- `C_PRISMA_HISTORY_PRESENT` — существует `_prisma_migrations`. Сначала требуется reconciliation существующей history; само наличие таблицы не разрешает `migrate deploy`.
- `D_AUTH_SCHEMA_ONLY` — domain schema отсутствует, но Better Auth objects уже существуют. Их нужно сохранить и сверить provider verifier-ом перед проектированием domain baseline.
- `REVIEW_NONEMPTY_OTHER_SCHEMA` — база непустая, но найденные объекты нельзя безопасно отнести только к текущему domain/auth contract. Нужен полный review.

Любой результат кроме `A_EMPTY_DATABASE` требует полного structural review перед созданием baseline migration.

## Шаг 2 — полный structural baseline

Если summary показывает непустую/неоднозначную базу, на **доверенной машине** выполнить:

```bash
npm run db:inspect:baseline > database-baseline.json
```

Полный inspector также использует `BEGIN READ ONLY` и после чтения выполняет `ROLLBACK`.

Он собирает:

- identity/версию PostgreSQL;
- пользовательские schemas;
- tables/views;
- columns, defaults и nullable flags;
- PostgreSQL enums;
- indexes;
- constraints;
- наличие `public._prisma_migrations`;
- количество строк migration history;
- SHA-256 fingerprint структурного snapshot.

Содержимое пользовательских таблиц не читается. Анкеты, документы, персональные данные, пароли, TOTP secrets и auth tokens в snapshot не попадают.

### Защита публичного CI

Полный inspector намеренно **отказывается работать при `GITHUB_ACTIONS=true`**.

Причина: repository публичный, а полный structural snapshot раскрывает внутреннюю структуру БД. Даже без PII такую информацию нельзя без необходимости публиковать в Actions logs/artifacts.

Для CI/общедоступного вывода используется только `db:inspect:baseline:summary`.

## Как хранить полный baseline

`database-baseline.json` не коммитить в публичный repository.

Хранить его только в контролируемом локальном/закрытом рабочем контуре, достаточном для сравнения с `prisma/schema.prisma` и подготовки reviewed migration SQL.

Строка `DATABASE_BASELINE_PASS` выводится в stderr, поэтому JSON stdout пригоден для перенаправления в файл.

## Решение после inspection

### `_prisma_migrations` отсутствует

Если domain tables уже существуют, база считается pre-existing. Нужно сравнить реальную структуру с текущей schema и сформировать baseline, представляющий фактически существующие objects. Нельзя пересоздавать populated tables только ради migration history.

### `_prisma_migrations` существует

Нужно отдельно проверить migration names/checksums, applied/unfinished state и соответствие history текущему приложению. Только после reconciliation можно проектировать дальнейшие migrations.

### Better Auth tables существуют

Их physical schema является provider-owned и проверяется через:

```bash
npm run check:staging:auth-schema
```

Better Auth auto-migrations не являются допустимым shortcut.

## Запрещённые shortcuts

До завершения baseline review запрещено:

- `prisma db push` против production;
- `prisma migrate dev` против production;
- `prisma migrate reset` против production;
- Better Auth auto-migrations против production;
- ручное создание/удаление tables через console «по месту»;
- удаление/переименование existing columns только ради совпадения с текущим Prisma schema;
- создание фиктивной migration history без подтверждённого состояния authoritative PostgreSQL.

## Следующий gate

После получения authoritative baseline:

1. подтвердить backup/snapshot и restore procedure;
2. сравнить фактическую структуру с `prisma/schema.prisma`;
3. определить legacy/provider-owned objects, которые должны сохраняться;
4. сформировать reviewed migration SQL;
5. зафиксировать migration-history SHA-256;
6. применить migration только к staging/non-production DB через guarded path;
7. выполнить `db:verify:staging`, Better Auth schema verification и DB-backed authz/workflow E2E;
8. только после этих evidence рассматривать production migration.
