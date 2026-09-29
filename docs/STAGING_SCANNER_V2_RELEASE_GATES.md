# iБюро — staging-v2 scanner release gates (22 сентября 2026)

**Только актуальная последовательность проверок. Не является разрешением на merge, deployment или обработку документов.** Старые инструкции по созданию новой VM и настройке Yandex Object Storage не применяются к текущему staging-v2.

## Проверенное состояние на момент записи

- Тестовый хост: `scanner-v2-staging.iburo127.online`; ранее проверенный внешний HTTPS отвечает `401` без авторизации. Это не подтверждает авторизованный `/health`.
- Yandex Certificate Manager certificate `fpqg6c69vqs7khjkhcmt`: действителен до `2026-12-21T08:34:45Z`. Проверка срока прошла; автоматическая синхронизация PEM-файлов с VM **не реализована**.
- Единственное видимое в списке проекта приватное Vercel Blob-хранилище: `iburo127-staging-blob`, привязано к Preview и содержит существующие `cases/` и `profile-avatars/`. Оно **не является одноразовым**.
- Audit-ветка и защищённый Preview alias указывают на `2a62a74578796f48676c889b79708e336883e07e`; на этом SHA отсутствует маршрут выдачи временных ссылок.
- Единый исходный кандидат [PR #22](https://github.com/misterio712rino/iburo127/pull/22) HEAD `e08b7009a3f694f8c12bbbc9fdff0875582a8f9c`, основан на audit HEAD; CI #3070 и Secret History #2336 PASS. PR **DRAFT, NOT MERGED; не развернут на утверждённом audit Preview**.
- 43 настоящих `PENDING_SCAN` — не тестовые файлы; статус и содержимое не изменять.

## Gate A — кандидат и доступы (только чтение)

1. Сверить SHA audit-ветки, PR #22 и deployment, их неизменность на протяжении этапа. Не считать Preview READY подтверждением работы эндпоинта.
2. Провести независимый review полного PR #22: OIDC repository/ref/workflow/SHA/run binding, manual-only permission, точные пути, ограничение операции/TTL, store binding и cleanup с подтверждённым PUT и ETag.
3. Проверить точный **не секретный** private Blob hostname через доверенные метаданные подключённого хранилища и сверить с host, закреплённым в Preview. Не просматривать `cases/`, `profile-avatars/`, клиентские записи или токены.
4. Проверить отсутствие общего Blob-токена в GitHub Actions; `BLOB_READ_WRITE_TOKEN` существующего клиентского хранилища туда не копировать.

## Gate B — контролируемый rollout issuer (отдельное одобрение)

1. До любых изменений убедиться, что PR #22 имеет свежие CI/security PASS для неизменного SHA, отсутствуют review blockers и согласован конкретный target `audit/production-readiness`. Никакой merge «по инерции».
2. После отдельно разрешённой интеграции подтвердить новый audit SHA, готовность **соответствующего** защищённого Preview, совпадение SHA с identity endpoint и отсутствие производственных изменений.
3. Включать `IB_STAGING_SCANNER_FIXTURE_ISSUER_ENABLED=true` только в проверенном audit Preview и только после независимого подтверждения `IB_RUNTIME_TARGET=staging`, `IB_STORAGE_TARGET=staging`, корректного Blob store/hostname и изоляции Production. Не включать флаг в иных Preview-ветках.
4. Провести отрицательные тесты без секретов: production/non-audit/disabled/OIDC-ошибка должны отказать **до** доступа к Blob credentials. Проверить на уже развёрнутом SHA, не только локальными моками.
5. При несоответствии любого SHA/host/флага немедленно остановить rollout, отключить только staging issuer flag и вернуть прежний проверенный audit deployment в рамках отдельно согласованного rollback; production не трогать.

## Gate C — авторизованное staging-здоровье и синтетический smoke

1. Отдельный staging-only секрет сканера должен соответствовать хосту и GitHub Actions secret `IB_STAGING_FILE_SCANNER_SECRET`. Наличие и привязку проверить через авторизованный канал **без вывода значения**; сверить SHA-256 fingerprint, не выводя секрет.
2. Прежде чем отправлять файлы, проверить CA-verified HTTPS, авторизованный `/health`, запущенный точный immutable image и актуальные сигнатуры ClamAV. `401` без авторизации — лишь отрицательный тест.
3. Workflow запускать только вручную на exact audit SHA, exact scanner origin `https://scanner-v2-staging.iburo127.online`, exact verified Blob private hostname и с предусмотренным подтверждением. OIDC GitHub идентичности должен совпадать с commit SHA развёрнутого issuer.
4. Только две искусственные фикстуры с путями `security-fixtures/file-scanner/<SHA>/<run-id>-<attempt>/clean.txt` и `eicar.txt`. До PUT проверить отсутствие обоих объектов; при неоднозначном ответе остановиться.
5. Ожидаемые результаты — `CLEAN` и `MALICIOUS`; удалить только объекты с подтверждённой текущим запуском загрузкой и совпадающим ETag, затем независимо убедиться в отсутствии обоих точных путей. При потерянном подтверждении загрузки не удалять спорный объект автоматически.
6. Любой другой исход, отсутствие credentials, 401/403, неподтверждённая очистка или изменение реальных файлов означает **BLOCKED**, а не PASS. 43 настоящих файла не запускать в сканер.

## Gate D — обновление TLS и готовность выпуска

- Отдельно подтвердить certificate-scoped право downloader для идентичности именно staging-v2 VM, без broad editor/admin и без облачного ключа в сканирующем контейнере. Не повторять одноразовый установщик и не читать приватный ключ в лог.
- До включения таймера реализовать загрузку нового сертификата в закрытую временную директорию, проверку hostname, expiry, соответствия cert/key, атомарную замену, Caddy validate/reload, внешнюю CA-verified проверку и откат. Затем проверить реальное обновление и сигнализацию об отказах.
- Только после Gate A–D выполнить полный staging QA приложения, API, ролей, private storage, очередей и мобильного браузера; составить независимый release report с точными SHA и PASS/FAIL.
- Production promotion, обработка накопленных 43 файлов, фоновые worker/scheduler, migrations, платные ресурсы и слияние исторических PR #1/#11 требуют отдельных target-specific решений. До них release status **BLOCKED**.

## Документальные источники состояния

- [Issue #8 — master scanner blocker](https://github.com/misterio712rino/iburo127/issues/8)
- [PR #22 — интегрированный исходный кандидат](https://github.com/misterio712rino/iburo127/pull/22)
- [PR #13 — TLS verifier и проверка пары](https://github.com/misterio712rino/iburo127/pull/13)

**Этот документ обновляет операционную последовательность, но ничего не включает и не подтверждает live CLEAN/EICAR smoke. Перед действиями перепроверить актуальные SHA, конфигурацию и разрешённые границы.**
