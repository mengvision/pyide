FROM python:3.12-slim

WORKDIR /app

COPY packages/server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install pykernel package (needed for kernel subprocess spawning)
COPY packages/pykernel /tmp/pykernel
RUN pip install --no-cache-dir /tmp/pykernel && rm -rf /tmp/pykernel

COPY packages/server/app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
