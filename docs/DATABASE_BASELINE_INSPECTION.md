# iБюро — безопасная проверка baseline PostgreSQL

Перед созданием первой migration history для production/staging необходимо сначала зафиксировать фактическую структуру существующей PostgreSQL базы. Нельзя считать текущий `prisma/schema.prisma` доказательством того, что реальная база уже соответствует этой схеме.

## Команда

```bash
npm run db:inspect:baseline
```

Команда требует только `DATABASE_URL` и выполняет исключительно read-only introspection.

Скрипт явно открывает:

```sql
BEGIN READ ONLY;
```

и после получения структуры выполняет `ROLLBACK`.

Он не запускает Prisma migrations, `db push`, DDL, DML, seed или Better Auth migration helpers.

## Что собирается

- имя базы и PostgreSQL user;
- версия PostgreSQL;
- пользовательские schemas;
- tables/views;
- columns, defaults и nullable flags;
- PostgreSQL enums;
- indexes;
- constraints;
- наличие `public._prisma_migrations`;
- количество строк migration history, если таблица существует;
- SHA-256 fingerprint структурного snapshot.

Содержимое пользовательских таблиц не читается. Анкеты, документы, персональные данные и auth credentials в snapshot не попадают.

## Как сохранить baseline

На доверенной машине с доступом к authoritative PostgreSQL:

```bash
npm run db:inspect:baseline > database-baseline.json
```

Строка `DATABASE_BASELINE_PASS` выводится в stderr, поэтому JSON stdout остаётся пригодным для сохранения в файл.

`database-baseline.json` не следует автоматически коммитить в публичный repository: даже без строк пользовательских данных структура БД может раскрывать внутренние детали инфраструктуры. Сначала документ должен быть просмотрен вручную.

## Решение после inspection

### `_prisma_migrations` отсутствует

Это означает, что migration history Prisma не подтверждена. Следующий шаг — сравнить фактическую структуру с желаемой schema и подготовить baseline migration без применения её к production.

### `_prisma_migrations` существует

Нужно отдельно проверить её migration names/checksums и убедиться, что history относится именно к этой версии приложения. Само наличие таблицы не является достаточным основанием запускать `prisma migrate deploy`.

## Запрещённые shortcuts

До завершения baseline review запрещено:

- `prisma db push` против production;
- `prisma migrate dev` против production;
- Better Auth auto-migrations против production;
- ручное создание недостающих таблиц через console "по месту";
- удаление/переименование existing columns только ради совпадения с текущим Prisma schema.

## Следующий gate

После получения baseline необходимо:

1. сохранить backup/snapshot средствами PostgreSQL/Yandex Managed Service;
2. сравнить фактическую структуру с `prisma/schema.prisma`;
3. определить, какие таблицы являются legacy и должны сохраняться;
4. сформировать reviewed migration SQL;
5. применить migration только к staging clone/non-production DB;
6. выполнить DB-backed auth/authorization/workflow E2E;
7. только после этого рассматривать production migration.
