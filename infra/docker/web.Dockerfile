# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
