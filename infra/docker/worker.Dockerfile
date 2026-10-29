# syntax=docker/dockerfile:1
FROM node:24-alpine
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 8081
CMD ["pnpm", "--filter", "@click/worker", "start"]
