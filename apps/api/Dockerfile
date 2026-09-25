# Build context is the repo root: the API imports @clasp/sdk from the workspace.
#   docker build -f apps/api/Dockerfile -t ghcr.io/<owner>/clasp-api:<sha> .
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Every workspace manifest the lockfile knows about must be present, or
# --frozen-lockfile refuses the install even for an unrelated filter.
COPY packages/sdk/package.json packages/sdk/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter @clasp/api...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# The whole install tree, whichever workspace packages ended up with their
# own node_modules.
COPY --from=deps /app ./
COPY packages/sdk ./packages/sdk
COPY apps/api ./apps/api

WORKDIR /app/apps/api
USER node
EXPOSE 8080

# Node 24 strips the type annotations at load time, so the TypeScript sources
# run directly: no build step and no emitted JavaScript to keep in sync.
#
# One image, two roles. ROLE unset (index) serves HTTP and can scale out; ROLE=indexer
# builds the read model and runs the keeper, and must stay a singleton — two
# keepers would race each other's sends.
CMD ["sh", "-c", "node src/migrate.ts && exec node src/${ROLE:-index}.ts"]
