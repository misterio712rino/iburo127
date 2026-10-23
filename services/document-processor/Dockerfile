FROM python:3.12.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    IB_DOCUMENT_PROCESSOR_HOST=0.0.0.0 \
    IB_DOCUMENT_PROCESSOR_PORT=8080

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-rus \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --home-dir /nonexistent --shell /usr/sbin/nologin app

COPY requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

WORKDIR /service
COPY src ./src
RUN chown -R app:app /service
USER 10001:10001

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c 'import os,urllib.request; req=urllib.request.Request("http://127.0.0.1:8080/health",headers={"Authorization":"Bearer "+os.environ.get("IB_DOCUMENT_PROCESSOR_TOKEN","")}); urllib.request.urlopen(req,timeout=3)' || exit 1
CMD ["python", "-m", "src.server"]
