# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim

# Chromium is the meeting participant. fonts-liberation keeps Meet's UI from
# rendering with missing glyphs; ca-certificates is required for provider TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile --filter @click/bot...

ENV NODE_ENV=production \
    BOT_PORT=8090 \
    BOT_CHROMIUM_PATH=/usr/bin/chromium \
    BOT_HEADLESS=true \
    BOT_ARTIFACTS_DIR=/data/bot \
    BOT_STATE_FILE=/data/bot/circuit-breaker.json

VOLUME ["/data/bot"]
EXPOSE 8090
CMD ["pnpm", "--filter", "@click/bot", "start"]
