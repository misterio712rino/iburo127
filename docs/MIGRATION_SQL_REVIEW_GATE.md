# iБюро — Migration SQL Review Gate

Перед применением любой Prisma/Better Auth migration к staging или production SQL должен пройти отдельную review-проверку.

## Команда

```bash
IB_MIGRATION_SQL_PATH=path/to/migration.sql npm run db:review:sql
```

Команда ничего не подключает к PostgreSQL и ничего не применяет. Она только читает указанный SQL-файл локально.

## Что фиксируется

- абсолютный путь к SQL;
- SHA-256 файла;
- приблизительное количество SQL statements;
- автоматические findings по high-risk операциям.

## Автоматически блокируемые паттерны

- `DROP TABLE`;
- `DROP COLUMN`;
- `TRUNCATE`;
- изменение типа колонки через `ALTER COLUMN ... TYPE`;
- `DROP TYPE`.

Наличие такого SQL не означает, что изменение невозможно. Оно означает, что migration нельзя продвигать дальше автоматически: требуется отдельный план сохранения/преобразования данных и ручной review.

## Требующие ручного review паттерны

- `ALTER TYPE`;
- `SET NOT NULL`;
- новые UNIQUE constraints/indexes;
- `CASCADE`;
- потенциальные `DELETE` statements.

## Обязательная последовательность

1. Снять read-only baseline через `npm run db:inspect:baseline`.
2. Сделать backup/snapshot authoritative database средствами инфраструктуры.
3. Сгенерировать migration SQL без применения к production.
4. Запустить `npm run db:review:sql`.
5. Вручную проверить SQL и сопоставить его с baseline fingerprint.
6. Применить только к staging.
7. Выполнить `check:staging`, `check:staging:authz` и DB-backed E2E.
8. Повторно review exact SQL перед production rollout.

## Запрещено

- использовать `prisma db push` как production migration strategy;
- автоматически обходить BLOCK findings;
- применять Better Auth auto-migrations непосредственно к production;
- считать отсутствие автоматических findings доказательством полной безопасности SQL.

Автоматический scanner — дополнительный guard, а не замена инженерного review.
