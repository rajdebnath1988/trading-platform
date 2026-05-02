# syntax=docker/dockerfile:1.7
FROM python:3.11-slim AS builder
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
# Install to isolated prefix — only the packages, no build tools
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim AS final
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# Remove pip, setuptools, wheel from final stage — not needed at runtime
# This eliminates the CVE-2026-24049 wheel vulnerability entirely
RUN pip uninstall -y pip setuptools wheel 2>/dev/null || true && \
    useradd -r -u 1001 -g root appuser
WORKDIR /app
# Copy only installed runtime packages from builder
COPY --from=builder /install/lib /usr/local/lib
COPY --from=builder /install/bin/uvicorn /usr/local/bin/uvicorn
COPY --chown=appuser:root app/ ./app/
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
