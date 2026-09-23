FROM node:24-bookworm-slim AS node-runtime

FROM clamav/clamav-debian:1.4.6_base@sha256:9245cc23e6d080de80bfd2bf0eb84650db0465de1ebcba9fd408e10b65503854 AS runtime

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates gosu tini \
  && rm -rf /var/lib/apt/lists/*

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node

COPY config/clamd.conf /etc/clamav/clamd.conf
COPY config/freshclam.conf /etc/clamav/freshclam.conf

ARG IB_SCANNER_SEED_SIGNATURES=0
RUN case "$IB_SCANNER_SEED_SIGNATURES" in 0|1) ;; *) exit 64 ;; esac \
  && if [ "$IB_SCANNER_SEED_SIGNATURES" = "1" ]; then \
       install -d -m 0755 -o clamav -g clamav /opt/clamav-seed; \
       sed \
         -e 's#^[[:space:]]*DatabaseDirectory[[:space:]].*#DatabaseDirectory /opt/clamav-seed#' \
         -e '/^[[:space:]]*NotifyClamd[[:space:]]/d' \
         /etc/clamav/freshclam.conf > /tmp/freshclam.seed.conf; \
       freshclam --stdout --config-file=/tmp/freshclam.seed.conf; \
       gosu clamav test -s /opt/clamav-seed/main.cvd; \
       gosu clamav test -s /opt/clamav-seed/daily.cvd; \
       rm -f /tmp/freshclam.seed.conf /opt/clamav-seed/freshclam.dat; \
     fi

WORKDIR /service
COPY package.json ./package.json
COPY src ./src
COPY entrypoint.sh /usr/local/bin/file-scanner-entrypoint
RUN chmod 0755 /usr/local/bin/file-scanner-entrypoint \
  && chown -R clamav:clamav /service

ENV NODE_ENV=production \
    IB_SCANNER_HOST=0.0.0.0 \
    IB_SCANNER_PORT=8080 \
    IB_SCANNER_CLAMD_HOST=127.0.0.1 \
    IB_SCANNER_CLAMD_PORT=3310 \
    IB_SCANNER_SIGNATURE_DIRECTORY=/var/lib/clamav

EXPOSE 8080
VOLUME ["/var/lib/clamav"]
HEALTHCHECK NONE
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/file-scanner-entrypoint"]
