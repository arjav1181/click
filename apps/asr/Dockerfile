FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ASR_MODEL_DIR=/models \
    ASR_DEVICE=cpu \
    ASR_COMPUTE_TYPE=int8

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .

VOLUME ["/models"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
