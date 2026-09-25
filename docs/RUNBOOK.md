# Clasp — runbook

Operating the Clasp backend on **Robinhood Chain mainnet** (chain id `4663`).
Contracts are immutable and hold every coin and every wei; nothing in this
runbook can move user funds. What runs off chain is a read model, a keeper
that does permissionless chores, and an image host.

## Services

| Service | What | Scale |
|---|---|---|
| `api` | `apps/api`, `ROLE` unset (runs `src/index.ts`). Fastify read API + image upload/serving. Stateless, holds no key. | 1+ replicas |
| `indexer` | `apps/api`, `ROLE=indexer` (runs `src/indexer.ts`). Indexes confirmed blocks into Postgres, reconciles vault state every minute, runs the keeper. | **exactly 1** — two keepers would race each other's sends |
| `postgres` | Postgres 16 (Railway plugin). The read model; rebuildable from chain at any time. | 1 |
| `web` | `apps/web`, Next.js. Talks to `api` over HTTPS; builds and signs transactions in the browser. | 1+ |

Both backend roles run the same image. On boot each replays
`src/schema.sql` (idempotent, guarded by an advisory lock) and then starts its
role: `node src/migrate.ts && exec node src/${ROLE:-index}.ts`.

```
browser ──HTTPS──> api ──SQL──> postgres <──SQL── indexer ──RPC──> Robinhood Chain
   │                │                                 │  (keeper sends: harvest,
   └──wallet tx─────┴──live reads (pending, health)───┘   unlock, claimTreasury)
```

## Environment

Secrets live only in the platform's variables. Never commit them; the repo
`.gitignore` and the Docker ignore rules below exclude `.env*` everywhere.

| Variable | Role | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | both | — (required) | Railway Postgres reference variable. |
| `RPC_URL` | both | `https://rpc.mainnet.chain.robinhood.com` | The public RPC rate-limits bursts (HTTP 429) and keeps only ~12–18 minutes of historical state (older `eth_call`/`eth_getBalance` at a past block fail; logs are kept). A private endpoint is strongly recommended for the indexer. |
| `CHAIN_ID` | both | `4663` | Boot fails if `RPC_URL` serves another chain (indexer). `4663` also switches on the mainnet checks below. |
| `LOG_LEVEL` | both | `info` | `debug` logs every empty indexer range. |
| `NODE_ENV` | both | set to `production` by the image | |
| `PORT` / `HOST` | api | `8080` / `0.0.0.0` | |
| `CORS_ORIGINS` | api | — | Comma-separated bare origins, e.g. `https://clasp.fun,https://www.clasp.fun`. **Boot fails on mainnet if unset or `*`.** No credentials are allowed cross-origin (none are used). |
| `PUBLIC_API_URL` | api | `http://localhost:$PORT` | e.g. `https://api.clasp.fun`. Required in production: it is baked into uploaded image URLs, which are written on chain as a coin's logo and can never change. |
| `START_BLOCK` | indexer | `deployBlock` from `@clasp/sdk` (72566517) | Where the first scan starts (ClaspFactory deploy block). Override only to rescan from a different block when no cursor is saved. |
| `CONFIRMATIONS` | indexer | `20` | Blocks the indexer stays behind head (~2 s at ~0.1 s blocks). |
| `LOG_RANGE` | indexer | `50000` | Max blocks per `eth_getLogs`; halved automatically on any RPC error, grown back on success. |
| `POLL_MS` | indexer | `3000` | Sleep between passes once caught up. |
| `RECONCILE_MS` | indexer | `60000` | Vault/market reconcile and keeper cadence. |
| `IPFS_GATEWAY` | indexer | `https://ipfs.io/ipfs/` | Only used to rewrite `ipfs://` logos into https URLs; nothing is fetched. |
| `KEEPER_PRIVATE_KEY` | indexer | — | `0x`-prefixed 32-byte hex. **Required when `NODE_ENV=production`.** Gas-only hot key; see *Keeper*. Never set it on `api`. |
| `KEEPER_MIN_BALANCE_WEI` | indexer | `2000000000000000` (0.002 ETH) | Below this the keeper refuses to send and logs/records it. |
| `HARVEST_THRESHOLD_WEI` | indexer | `1000000000000000` (0.001 ETH) | Harvest a vault when its Pons escrow balance plus (pre-graduation, while the vault is the recipient) the creator fees still on the curve reach this. |
| `TREASURY_CLAIM_THRESHOLD_WEI` | indexer | `10000000000000000` (0.01 ETH) | `claimTreasury()` a vault (at most hourly) when `treasuryOwed` reaches this. |
| `UNLOCKS_PER_TICK` | indexer | `10` | Matured positions released per keeper pass (shared round-robin across vaults). |
| `UNLOCK_MAX_GAS` | indexer | `500000` | An unlock whose gas estimate exceeds this (e.g. an owner contract whose `receive()` burns gas) is skipped and backed off. A normal unlock costs ~170k. |
| `CLASP_FACTORY_ADDRESS`, `CLASP_ROUTER_ADDRESS`, `CLASP_LAUNCHER_ADDRESS` | both | from `@clasp/sdk` | **Local forks only.** Override the published addresses. Leave unset in production. The launcher address is needed to credit coins launched through ClaspLauncher to their real creator (its `Launched` event) rather than to the launcher contract. |

### Fork rehearsals

`anvil --fork-url <RPC>` pins a block and lazily fetches state *at that
block*. The public RPC only serves historical state for ~12–18 minutes, so a
fork against it breaks (state reads start failing) once the pinned block ages
past that window. Finish a rehearsal inside ~10 minutes of starting anvil, or
fork from an archive / private RPC. Restart anvil (a fresh fork block) for
every rehearsal run.

## Deploy (Railway, prebuilt images on GHCR)

Images are built once, pushed to GHCR, and Railway pulls them; Railway never
builds from source, so what runs is exactly what was tested.

1. **Build** from the repo root (the image needs the workspace for `@clasp/sdk`):
   ```sh
   SHA=$(git rev-parse --short HEAD)
   docker build -f apps/api/Dockerfile -t ghcr.io/<owner>/clasp-api:$SHA .
   ```
2. **Push**: `echo $GHCR_TOKEN | docker login ghcr.io -u <owner> --password-stdin`
   (a token with `write:packages` only), then `docker push ghcr.io/<owner>/clasp-api:$SHA`.
3. **Railway project**: add the Postgres plugin; create services `api` and
   `indexer`, both *Deploy from Docker image* `ghcr.io/<owner>/clasp-api:$SHA`
   (add GHCR credentials under the service's registry settings if the package
   is private).
4. **Variables**: set the table above. `indexer`: `ROLE=indexer`,
   `START_BLOCK`, `KEEPER_PRIVATE_KEY`, optional thresholds. `api`: no `ROLE`,
   `CORS_ORIGINS`, `PUBLIC_API_URL`. Both: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `RPC_URL`.
5. **Networking**: public domain `api.clasp.fun` on `api` only (port 8080).
   `indexer` gets no public domain. Health check path for `api`: `/health`.
6. **Replicas**: `indexer` = 1, and set its deploy strategy so the old
   container stops before the new one starts (no overlap → no double keeper).
7. **Roll forward** by retagging the image in both services; roll back by
   pointing them at the previous `$SHA`. The schema is additive only, so an
   older image runs against a newer schema.

First boot of `indexer` scans from `START_BLOCK` to head in `LOG_RANGE`
chunks; progress is the `indexed` log line (`behind` field) and
`SELECT * FROM indexer_cursor`.

### Website (`apps/web`)

All website variables are public and baked in at build time (Docker build
args; see `apps/web/Dockerfile` and `apps/web/.env.example`):

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.clasp.fun` | The API. Its `CORS_ORIGINS` must include this site's origin (`NEXT_PUBLIC_SITE_URL`) for GET and `POST /api/images`. |
| `NEXT_PUBLIC_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` | Browser reads and wallet transactions. |
| `NEXT_PUBLIC_SITE_URL` | `https://clasp.fun` | |
| `NEXT_PUBLIC_PRIVY_APP_ID` | — | Required in production (empty = browser-wallet-only dev mode). The Privy dashboard must allow the site origin. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | — | Optional. |

Build from the repo root and push like the API image:
`docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_PRIVY_APP_ID=... -t ghcr.io/<owner>/clasp-web:$SHA .`
Railway service `web` runs `node apps/web/server.js` on port 3000; public
domain `clasp.fun`.

### Docker ignore rules (repo-root `.dockerignore`)

The build context is the repo root, so the root `.dockerignore` must keep
secrets, other apps' build output and Foundry artifacts out of it:

```
node_modules
**/node_modules
**/.next
contracts/out
contracts/cache
contracts/lib
contracts/broadcast
.git
*.log
**/*.tsbuildinfo

# Secrets and local config must never reach an image. Patterns are rooted at
# the build context, so each needs the **/ prefix to cover apps/*.
.secrets
**/.env
**/.env.*
!**/.env.example
**/*.tmp
**/*.tmp.*
**/.keeper-*.json
**/*.key
```

## Keeper

Runs inside `indexer` after every reconcile pass, and only when the indexer
is caught up. All three chores are permissionless contract calls that pay only
the rightful party, so the key can at worst spend its own gas:

- `harvest()` on a vault whose unharvested creator fees (Pons escrow balance,
  plus the creator share still on the curve before graduation while the vault
  is the recipient) reach `HARVEST_THRESHOLD_WEI`.
  A failed harvest backs that vault off (1 min doubling to 1 h).
- `unlock(id)` for matured positions (maturity judged by the latest block's
  timestamp). A matured position keeps its full reward weight until someone
  unlocks it (see SECURITY.md), diluting active lockers, so: within a vault the
  largest weights go first; across vaults the `UNLOCKS_PER_TICK` budget is
  shared round-robin, starting each pass after the vault served last, so no
  vault starves another. Each unlock is simulated and gas-estimated first; one
  that would revert or costs more than `UNLOCK_MAX_GAS` is skipped with a
  backoff doubling from 1 h to 24 h (recorded as `failed` in `keeper_runs`).
- `claimTreasury()` on a vault whose `treasuryOwed` ≥
  `TREASURY_CLAIM_THRESHOLD_WEI`, at most once per vault per hour.

Every call is simulated first (a would-revert call is recorded as `failed`
and costs nothing), then sent with a gas limit of 1.5× the estimate — vault
calls release the reward stream up to `block.timestamp`, so their cost at
inclusion can exceed an estimate taken a block earlier — and awaited before
the next one, so nonces never race. Every send and every refusal is a row in
`keeper_runs`.

### Funding

1. Generate a dedicated key (never reuse one): `cast wallet new`.
2. Its address: `cast wallet address --private-key <key>` (also logged at
   indexer start as `keeper`).
3. Send ETH on Robinhood Chain to that address. Keep a few weeks of gas;
   top up well before it approaches `KEEPER_MIN_BALANCE_WEI`.
4. Check the balance:
   `cast balance <address> -r https://rpc.mainnet.chain.robinhood.com --ether`.

The keeper holds only gas money. Nothing else is ever sent to it.

### Watching it

```sql
-- Last 50 keeper actions.
SELECT at, action, vault, position_id, status, tx_hash, detail FROM keeper_runs ORDER BY at DESC LIMIT 50;
-- Failures in the last day, by vault.
SELECT vault, action, count(*), max(detail) FROM keeper_runs
WHERE status IN ('failed', 'reverted') AND at > now() - interval '1 day' GROUP BY 1, 2 ORDER BY 3 DESC;
-- Gas spent in the last 7 days (wei).
SELECT sum(fee_wei) FROM keeper_runs WHERE at > now() - interval '7 days';
-- Overdue unlocks (should be near zero).
SELECT count(*) FROM positions WHERE open AND lock_end < extract(epoch FROM now()) - 3600;
```

## Incident playbook

**Indexer behind or stuck.** Check `indexed` log lines and
`SELECT block, updated_at FROM indexer_cursor`. Compare with
`cast block-number -r $RPC_URL`. Repeated `range failed; shrinking` means the
RPC is refusing `eth_getLogs` (rate limit or range cap): switch `RPC_URL` to a
private endpoint and restart. `indexer pass failed` with a DB error: check
Postgres health and disk.

**Data looks wrong / reorg deeper than `CONFIRMATIONS`.** Every write is
idempotent, so replaying is safe. Stop `indexer`, move the cursor back, start:
```sql
UPDATE indexer_cursor SET block = <block before the problem> WHERE name = 'main';
```
Positions, redirects and vault state converge on the next passes (vault
numbers are overwritten from chain every minute regardless). Full rebuild:
`TRUNCATE coins, positions, events, trades, admin_redirects, fee_recipient_changes, indexer_cursor;`
then restart with `START_BLOCK` = factory deploy block. `images` and
`keeper_runs` are not derived from chain — never truncate them.

**Keeper refusing (`ALERT keeper balance below minimum`, level error, field
`alert: "keeper_low_balance"`, logged hourly; also a `refused` row in
`keeper_runs`).** Alert on this log line. Fund the keeper address (above).
Fees keep accruing in the Pons escrow while it waits, but matured locks keep
diluting active lockers until they are unlocked — by the keeper, or by
anyone from the site.

**Keeper transaction stuck (`keeper receipt not seen`, row left `sent`).**
The next pass re-reads chain state, so nothing is double-sent blindly. If the
nonce is wedged, send a 0-value self-transfer at the stuck nonce with a higher
fee from the keeper key.

**Keeper key leaked.** It only holds gas. Stop `indexer`, generate a new key,
set `KEEPER_PRIVATE_KEY`, fund the new address, restart, and sweep what is
left of the old one.

**Pons admin redirect proposed for a Clasp coin.** The indexer records the
`CreatorFeeRecipientChangeProposed` event (`admin_redirects`) and the
reconcile pass mirrors the factory's pending slot, so the coin page shows the
warning banner automatically (`adminRedirectPending`). Pons's owner can
execute it after the 3-day timelock, within a further 3 days; it cannot be
blocked from our side. Announce it publicly with the coin, the proposed
recipient and `executableAt`. After execution `feeRecipientOk` turns false:
from then on only the 2% router fee reaches that vault.
```sql
SELECT token, new_recipient, to_timestamp(effective_at), to_timestamp(expires_at), status
FROM admin_redirects ORDER BY block_number DESC;
```

**Coin not showing fees.** `GET /api/coins/<token>`: `feeRecipientOk: false`
means Pons pays creator fees elsewhere (the coin registered but never
transferred its recipient to the vault, or was redirected).
`vaultState.escrowBalance` + `vaultState.curveFees` are unharvested creator
fees; the keeper harvests them at the threshold.

**Image abuse.** Uploads are rate-limited to 10/min per client address and
capped at 2 MB, content-sniffed to PNG/JPEG/GIF/WebP. To remove an image:
`DELETE FROM images WHERE sha256 = '<hash>';` (it 404s from then on; any coin
that used it shows no logo).

**API 429s for real users behind one address.** The limit is 240 req/min per
client address, keyed on the right-most `X-Forwarded-For` entry (the one
Railway's edge appends). Raise `max` in `src/index.ts` if needed.

**Database lost.** Restore the latest Railway backup, or rebuild from chain
(full rebuild above). Only `images` cannot be rebuilt from chain — back it up.
