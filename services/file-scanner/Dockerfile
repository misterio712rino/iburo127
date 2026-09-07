FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates clamav-daemon clamav-freshclam gosu tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /service
COPY package.json ./package.json
COPY src ./src
COPY config/clamd.conf /etc/clamav/clamd.conf
COPY config/freshclam.conf /etc/clamav/freshclam.conf
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
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/file-scanner-entrypoint"]
