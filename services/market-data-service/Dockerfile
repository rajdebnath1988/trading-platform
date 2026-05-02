FROM python:3.11-alpine AS builder
WORKDIR /app
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN python -m venv /venv && \
    /venv/bin/pip install --no-cache-dir --upgrade pip wheel==0.46.2 && \
    /venv/bin/pip install --no-cache-dir -r requirements.txt

FROM python:3.11-alpine AS final
RUN apk update && apk upgrade --no-cache
RUN addgroup -g 1001 -S appuser && adduser -S -u 1001 -G appuser appuser
WORKDIR /app
COPY --from=builder /venv /venv
COPY --chown=appuser:root app/ ./app/
RUN pip uninstall -y wheel pip setuptools 2>/dev/null || true
USER appuser
ENV PATH="/venv/bin:$PATH"
EXPOSE 8000
CMD ["/venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
