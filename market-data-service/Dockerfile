# syntax=docker/dockerfile:1.7
FROM python:3.11-alpine AS builder
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apk add --no-cache gcc musl-dev libffi-dev
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-alpine AS final
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# Alpine BusyBox adduser — -r flag does NOT exist in Alpine, use -S instead
RUN addgroup -S appgroup && adduser -S -u 1001 -G appgroup appuser
WORKDIR /app
COPY --from=builder /install/lib /usr/local/lib
COPY --from=builder /install/bin/uvicorn /usr/local/bin/uvicorn
COPY --chown=appuser:appgroup app/ ./app/
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
