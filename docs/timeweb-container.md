# Timeweb Cloud container staging

This is the self-hosted application image foundation. It does not provision a VM, database, S3 bucket, DNS record, TLS certificate, or production secret.

## Image targets

Build the web application image:

```sh
docker build --target web --tag iburo127-web:staging .
```

Build the one-shot maintenance request runner separately:

```sh
docker build --target maintenance-runner --tag iburo127-maintenance:staging .
```

The web image uses the standalone Next.js server, runs as the unprivileged `node` user, listens on port 3000, and exposes only a minimal liveness response at `/api/healthz`. That endpoint does not test PostgreSQL, object storage, or the scanner.

The maintenance target only contains `scripts/run-maintenance-job.mjs`. It does not start a scheduler or run jobs automatically. Schedule each bounded job separately after staging is configured and verified.

## Staging run

Create a host-side environment file from the variable names in `.env.example`. Fill it only with staging values. At minimum, set the staging runtime identity, public HTTPS origin, database connection, authentication settings, and the selected staging object-storage provider. Keep the file outside the repository and restrict it to the deployment account.

Attach the web container to the same user-defined Docker bridge as the staging database and proxy. The staging database hostname in `DATABASE_URL` must resolve on that bridge; the default Docker bridge does not provide container-name DNS. Keep the PostgreSQL port unpublished.

Run the app behind a TLS-terminating reverse proxy. Bind the application port to loopback so it is not directly exposed:

```sh
docker run --detach \
  --name iburo127-web-staging \
  --restart unless-stopped \
  --network iburo-staging \
  --env-file /etc/iburo/staging.env \
  --publish 127.0.0.1:3000:3000 \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  iburo127-web:staging
```

The proxy should forward HTTPS traffic to `127.0.0.1:3000`. Verify liveness with:

```sh
curl --fail --silent https://<staging-host>/api/healthz
```

For a one-shot maintenance check, use a separate environment file containing the staging origin and the independent maintenance secret:

```sh
docker run --rm \
  --env-file /etc/iburo/staging-maintenance.env \
  iburo127-maintenance:staging file-scan-health
```

Do not start maintenance jobs until their staging preflight and explicit enablement checks pass. Do not run database migrations from the web container entrypoint; apply reviewed migrations through the existing guarded staging migration workflow.

## Build boundary

Prisma client generation uses a non-routable placeholder URL during image build. It is not copied into the runtime image. No production database credentials or provider keys belong in Docker build arguments, image layers, or the repository.
