# syntax=docker/dockerfile:1.7
# Clasp website. Build from the repository root (pnpm workspace):
#   docker build -f apps/web/Dockerfile -t clasp-web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.clasp.fun .
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are build
# arguments, not runtime env. Never pass secrets here. Defaults target mainnet.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/package.json packages/sdk/
COPY apps/web/package.json apps/web/
RUN corepack pnpm install --frozen-lockfile --filter "@clasp/web..."

FROM deps AS build
COPY packages/sdk packages/sdk
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL=https://api.clasp.fun
ARG NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
ARG NEXT_PUBLIC_SITE_URL=https://clasp.fun
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack pnpm --filter @clasp/web build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S clasp && adduser -S clasp -G clasp
# `output: 'standalone'` traced from the repo root keeps the workspace layout.
COPY --from=build --chown=clasp:clasp /repo/apps/web/.next/standalone ./
COPY --from=build --chown=clasp:clasp /repo/apps/web/.next/static ./apps/web/.next/static
USER clasp
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
