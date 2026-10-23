# Clasp

Clasp lets holders of a memecoin lock their coins and earn that coin's trading fees in ETH; the longer and larger the lock, the bigger the share. Coins are launched on the Pons launchpad through Clasp, so each coin's creator fees flow to its Clasp vault from the first trade. It runs on Robinhood Chain mainnet (chain id `4663`).

The full behaviour is specified in [`docs/SPEC.md`](docs/SPEC.md); operations are in [`docs/RUNBOOK.md`](docs/RUNBOOK.md) and the threat model in [`docs/SECURITY.md`](docs/SECURITY.md).

## Features

- Launch a coin on Pons through `ClaspLauncher`, with its fees routed to a per-coin `ClaspVault`
- Lock coins for a chosen duration; extend, add more, unlock early or unlock at maturity
- Fee share weighted by lock size and duration, harvested and paid in ETH
- Read API and indexer that rebuild state from chain into Postgres
- Keeper that performs permissionless chores (harvest, matured unlocks, treasury claims)
- Optional Google sign-in with Clasp-held custodial wallets
- Web app with coin list, coin pages, buy/sell, lock management and leaderboards

## Stack

- Contracts: Solidity, Foundry (forge-std, OpenZeppelin, Uniswap v4-core)
- SDK: TypeScript, viem (`@clasp/sdk`)
- API / indexer / keeper: Node.js, Fastify, Postgres, zod
- Web: Next.js 15, React 19, wagmi, viem, TanStack Query
- Monorepo: pnpm workspaces; deployed on Railway

## Project structure

```
contracts/      Solidity contracts (ClaspFactory, ClaspVault, ClaspRouter, ClaspLauncher), tests, deploy script
packages/sdk/   Shared ABIs, deployed addresses, fee/lock math
apps/api/       Fastify read API, indexer, reconciler and keeper (ROLE selects the process)
apps/web/       Next.js website
docs/           SPEC, RUNBOOK, SECURITY
brand/          Graphics and video sources for social posts
```

## Setup

Requirements: Node.js 22+, pnpm 10, Postgres 16, Foundry (for contracts).

```bash
pnpm install

# API / indexer
cp apps/api/.env.example apps/api/.env
pnpm --filter @clasp/api migrate
pnpm --filter @clasp/api dev        # HTTP API
pnpm --filter @clasp/api indexer    # indexer + keeper

# Web
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @clasp/web dev

# Contracts
cd contracts && forge test
```

## Environment variables

`apps/api` (see `apps/api/src/env.ts` and `docs/RUNBOOK.md`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `RPC_URL`, `CHAIN_ID` | Chain RPC endpoint and id |
| `PORT`, `HOST`, `CORS_ORIGINS`, `PUBLIC_API_URL`, `SITE_URL` | HTTP role |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `CUSTODY_MASTER_KEY` | Google login with custodial wallets (all or none) |
| `START_BLOCK`, `CONFIRMATIONS`, `LOG_RANGE`, `POLL_MS`, `RECONCILE_MS`, `IPFS_GATEWAY` | Indexer |
| `KEEPER_PRIVATE_KEY`, `KEEPER_MIN_BALANCE_WEI`, `HARVEST_THRESHOLD_WEI`, `TREASURY_CLAIM_THRESHOLD_WEI`, `UNLOCKS_PER_TICK`, `UNLOCK_MAX_GAS` | Keeper |
| `CLASP_FACTORY_ADDRESS`, `CLASP_ROUTER_ADDRESS`, `CLASP_LAUNCHER_ADDRESS` | Local forks only |
| `LOG_LEVEL`, `NODE_ENV` | Logging / mode |

`apps/web`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_SITE_URL` (public, bundled into the browser).

## Status

Deployed to Robinhood Chain mainnet; the contracts are immutable. Experimental software: use at your own risk.
