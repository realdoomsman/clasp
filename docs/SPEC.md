# Clasp — specification

Clasp lets holders of a memecoin **lock** their coins and **earn that coin's
trading fees in ETH**. The longer and larger the lock, the bigger the share.
Chain: **Robinhood Chain mainnet** (chain id `4663`, native gas ETH, public RPC
`https://rpc.mainnet.chain.robinhood.com`, explorer
`https://robinhoodchain.blockscout.com`). Coins are launched on the **Pons**
launchpad (v2 stack) **through Clasp only**: a coin launched anywhere else can't be
added (see *Launch only*). This document is the shared contract between the
contracts, the SDK, the API/indexer/keeper and the website. Change it before
changing code.

## Launch only

A Clasp coin is a coin launched through `ClaspLauncher`. There is no way to
bring an existing Pons coin in: Pons's holder-rewards coins point their creator
fees at a Pons-owned distributor that can never hand them to anyone else, and a
coin whose fees a creator could redirect later is a weaker promise than one whose
fees are the vault's from the first trade. `ClaspFactory.createVault` stays
permissionless on-chain (the contracts are immutable), but the indexer only
registers a vault whose `VaultCreated.creator` is the launcher and whose
`Launched` event is in the same transaction; any other vault is ignored by the
API, the site and the keeper.

Plain-language pitch (use it on the site): *"Lock a coin you believe in. Earn a
share of every trade, paid in ETH."*

## Official coin and unlisted coins

`@clasp/sdk` exports `officialCoin` ($CLASP `0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3`,
vault `0x3db0…661d`) and `unlistedTokens`. The site features the official coin on
the home page, badges it and puts it first in the coin list, and shows its address
as the only official one. The dev's 1-year founding lock (`0x6866…8060`) earns like
any lock (a vault can't make a lock that doesn't earn); the dev gives those fees
away by buying back and burning CLASP, and copy must say exactly that, never "no
dev lock" or "the dev earns nothing on-chain". Unlisted coins (the $CLTEST mainnet
test) are left out of `/api/coins`, `/api/stats` and every leaderboard; their
pages stay reachable by address.

## Coin links (the on-chain website)

The launch form doesn't ask for a website: every coin launched from clasp.fun gets
`https://clasp.fun/l/<id>` (`coinLinkUrl` in `@clasp/sdk`; `<id>` is 10 random
`[a-z0-9]` picked by the form) as its Pons `socials.website`, so Pons pages and
chart sites send people to the coin's Clasp page. The token's own address can't
be used: Pons deploys the token with CREATE2 over creation code that includes the
socials, so the address depends on the link. `GET /api/links/:id` returns the
earliest coin (lowest `created_block`) whose indexed website is exactly that URL,
so a copy launched later with the same link can't take it over; `/l/<id>`
redirects (308) to `/coins/<token>`, or waits and retries while the coin is
still being indexed. The launcher itself doesn't enforce the link; coins
launched by calling it directly keep whatever website they passed. Coins
launched before this (including $CLASP) keep their original website.

## Where the money comes from

Every Clasp coin has one **vault** contract. ETH arrives in it from two places:

1. **Pons creator fees.** A coin's Pons `creatorFeeRecipient` is the vault.
   Pons credits those fees to the vault in its `PonsV2FeeEscrow`; anyone can
   call `vault.harvest()` to pull them in (the vault calls
   `FeeEscrow.claim()` as `msg.sender`).
2. **The Clasp trading fee: 2%** of the ETH side of every buy or sell routed
   through `ClaspRouter` (the website always uses the router). Sent to the
   vault in the same transaction as the trade. If the trade fails, no fee.

Split of everything that arrives: **90% to lockers, 10% to the Clasp
treasury, 0% to the creator.** Frozen per vault at creation.

The vault detects arrivals by **balance difference**: any ETH that lands
(router fee, escrow claim, plain transfer) is inflow. Only vault code moves ETH
out, and every outflow is recorded, so a balance drop that was not recorded
must revert.

## Pons facts the contracts rely on (verify against verified source/ABI)

- `PonsV2LaunchFactory` `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`
  (owner = 2-of-3 Safe `0x263ed295dAFaE1d9AAdD6E56c4B6F9f38eE019Dd`)
  - `getLaunchedToken(token)` → includes `creatorFeeRecipient`,
    `creatorTaxBps`, buyback flag, phase, poolId, pair token.
  - `transferCreatorFeeRecipient(token, newRecipient)` — only the current
    recipient. `ClaspLauncher` calls it once, at launch, to hand the fees to the
    new vault before any trade.
  - `launchToken(TokenParams, launchConfigId, pairToken)` payable
    (`launchFee()` = 0.0005 ETH) and `PonsV2LaunchAndBuy`
    `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948`
    `launchAndBuy(params, configId, pairToken, quoteIn, minOut, recipient, exemptions)`.
    `TokenParams.creatorFeeRecipient` sets the recipient at launch.
  - **Admin override:** owner can `setCreatorFeeRecipient` after a 3-day
    timelock (`CreatorFeeRecipientChangeProposed` event), then anyone can
    execute within 3 more days. Cannot be disabled. Clasp must surface this.
- `PonsV2FeeEscrow` `0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e`:
  `claim()` / `claimToken(token)` pay `msg.sender`. The native-ETH balance is
  **per recipient** (`_balances[recipient]`, aggregated across every launch the
  recipient is paid by); ERC-20 balances are per (recipient, token). `claim()`
  reverts `NoBalance` at zero. One vault per coin keeps a vault's escrow
  balance attributable to its coin.
- Pre-graduation creator fees sit in the bonding curve until
  `curve.sweepFees(minBuybackTokensOut)` (callable by the current creator fee
  recipient when no buyback is earmarked) or graduation credits them to the
  escrow; `harvest()` does that sweep. Post-graduation the hook's
  `sweepPoolFees(poolId, 0, 0)` works for the recipient only while no
  memecoin-denominated fees are pending; otherwise the Pons operator sweeps.
- Hook (post-graduation) `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044`,
  Uniswap v4 PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`.
- Clasp supports **ETH-paired Pons v2 coins only** (`pairToken == 0`) and
  **refuses coins with buyback enabled** (buyback vests would pay the vault in
  the memecoin, which it cannot distribute). Launches through Clasp set
  `buybackEnabled = false`.

## Lock economics (defaults, frozen onto each vault at creation)

| Term | Default |
|---|---|
| Lock window | 4 hours to 365 days |
| Duration multiplier | square-root curve, 1.0× at 4 h → 4.0× at 365 d: `1 + 3·sqrt((t−min)/(max−min))`, computed in integers as `10000 + isqrt(travelled·span)·30000/span` bps |
| Size tiers (share of `totalSupply()` in one lock) | ≥0.1% +10%, ≥0.5% +25%, ≥1% +50% (multiplies the duration multiplier) |
| Weight | `amount × durationBps × (10000 + sizeBonus) / 1e8` |
| Reward release | arrivals stream to lockers linearly over **1 hour** (`streamSecs`), so weight added after ETH arrives cannot snipe it |
| Early exit | burns `max(minPenaltyBps, penaltyBps × remaining/term)` of principal (default `penaltyBps` 25%, floor 5%; the factory caps `penaltyBps` at 50%) to `0x…dEaD`. **The principal burn is the only early-exit deterrent:** rewards already claimed are never clawed back (an owner can `claim` right before `earlyUnlock`); only still-unclaimed rewards are forfeited, back into the stream (not instantly) |
| Top-up (`increase`) | only while at least `minLockSecs` (4 h) remain, so added tokens are locked as long as a fresh lock (reverts `InvalidDuration` otherwise; `extend` first); reprices to the term left; `lockStart` blended so added tokens carry a fresh lock's penalty: `(A+B)/T' = A/T + B/R` |
| Extend | new end = now + duration, must be later than the current end |
| No lockers | if total weight is 0, the lockers' share goes to the treasury |
| Matured lock | **anyone** may unlock it; tokens and rewards go only to the owner. Until someone does, it keeps its full weight and keeps earning (known gap, see SECURITY.md); the keeper unlocks matured positions largest weight first |
| Minimum lock | 1 whole token (1e18 base units) |

Accounting: `accRewardPerWeight` scaled by `1e18` (use `mulDiv`),
`rewardDebt` per position in scaled units (keeps sub-wei residue; rounds so
the vault can never owe more than it holds). Invariant, tested after every
step of a random churn test: `sum(pending) + undistributed + treasuryOwed
+ dust ≤ vault.balance`.

ETH payouts use `call`. If a recipient reverts, the amount is credited to
`owed[recipient]` and withdrawable later with `withdrawOwed(to)` (the recipient
chooses the destination) — a reverting owner can never block anyone else.

## Contracts (Solidity ^0.8.24, Foundry, OpenZeppelin v5)

**Not upgradeable. No proxies. No admin path to any vault's ETH or tokens.**

- `ClaspFactory` — `Ownable2Step`. Holds default `Terms` and `treasury` for
  **future** vaults; `paused` blocks only `createVault`. Deploys one
  `ClaspVault` per token with CREATE2 (salt = token), so
  `predictVault(token)` is known before the coin exists.
  - `createVault(address token, bytes32 expectedTermsHash) returns (address
    vault)` — permissionless on-chain; reverts if a vault exists, the token is not a
    Pons v2 launch, is not ETH-paired, or has buyback on, and `TermsMismatch`
    if `expectedTermsHash != 0` and differs from `defaultsHash()`. Only calls made
    by `ClaspLauncher` create Clasp coins (*Launch only*); the vault exposes
    `isFeeRecipient()`.
  - `defaultsHash()` = `keccak256(abi.encode(defaults()))`, equal to
    `keccak256(abi.encode(vault.terms()))` of a vault created now.
  - Owner-settable defaults are bounded: treasury share ≤ 20%, `penaltyBps` ≤
    50%, `minLockSecs` ≤ 7 days and ≥ `streamSecs`, `minLockAmount` ≤ 1,000
    tokens (1000e18), `maxLockSecs` ≤ 5 years, `streamSecs` ≤ 7 days, size
    bonus ≤ +100%.
  - `predictVault(token)`, `vaultOf(token)`, `allVaults(i)`, `vaultCount()`.
  - Events: `VaultCreated(token indexed, vault indexed, creator, Terms)`,
    `DefaultsUpdated(Terms)`, `TreasuryUpdated(treasury)`, `Paused(bool)`.
- `ClaspVault` — one per coin; `token`, `treasury`, `terms` immutable.
  - `lock(amount, durationSecs) returns (uint256 id)` (pulls tokens with
    `transferFrom`, measures received by balance delta)
  - `lockFor(owner, amount, durationSecs)` (used by the launcher for the
    founding lock; tokens come from `msg.sender`)
  - `increase(id, amount)`, `extend(id, durationSecs)`, `claim(id)`,
    `claimAll(ids[])` (all owner only), `unlock(id)` (matured, anyone),
    `earlyUnlock(id)` (owner only), `harvest()` (anyone: curve/hook fee sweep
    best effort + escrow claim + sync), `sync()`, `claimTreasury()` (anyone;
    pays `treasury` only), `withdrawOwed(to)`, `receive()`.
  - Views: `pending(id)`, `position(id)`, `positionsOf(owner)` (open ids),
    `positionCount()`, `totalWeight`, `totalLocked`, `undistributed`,
    `streamEnd`, `accRewardPerWeight`, `treasuryOwed`, `totalOwed`,
    `owed(addr)`, `lifetimeInflow`, `lifetimeRewards` (ETH claimed by
    lockers), `isFeeRecipient()`, `previewMultiplier(amount, secs)`,
    `previewIncrease(id, amount)`, `previewEarlyUnlock(id)`. Stream-dependent
    views are simulated up to `block.timestamp`.
  - Events: `Locked(id indexed, owner indexed, amount, durationSecs,
    multiplierBps, weight, lockEnd)`, `Increased(id, amount, weight, lockStart)`,
    `Extended(id, lockEnd, multiplierBps, weight)`, `Claimed(id indexed, owner
    indexed, amount)`, `Unlocked(id indexed, owner indexed, amount, burned,
    forfeited, early)`, `FeesArrived(amount, toLockers, toTreasury)`,
    `TreasuryClaimed(amount)`, `Owed(recipient, amount)`,
    `OwedWithdrawn(recipient, to, amount)`. `Increased`/`Extended` index `id`;
    an extension restarts the lock (`lockStart = block.timestamp`).
- `ClaspRouter` — stateless. `buy(token, minOut, deadline) payable` and
  `sell(token, amountIn, minEthOut, deadline)`. Takes 2% of the ETH leg
  (buy: of `msg.value`, recomputed on the ETH actually spent if the market
  refunds part of it; sell: of ETH out) and sends it to
  `factory.vaultOf(token)` (reverts if none). Routes through the Pons
  bonding curve before graduation and the Pons Uniswap v4 hook pool after.
  `quoteBuy`, `quoteSell` views where feasible. Event `Trade(token indexed,
  trader indexed, isBuy, ethAmount, tokenAmount, fee)`.
- `ClaspLauncher` — one transaction: launch the coin on Pons (ETH pair,
  `buybackEnabled = false`) with the launcher itself as the initial
  `creatorFeeRecipient`, create the vault, require
  `keccak256(abi.encode(vault.terms())) == p.expectedTermsHash` and
  `vault.treasury() == p.expectedTreasury` (`TermsMismatch` /
  `TreasuryMismatch`; the web passes `factory.defaultsHash()` and
  `factory.treasury()` read when the user signs), `transferCreatorFeeRecipient(token,
  vault)` **before any trade**, do the creator's dev buy (no Clasp fee on
  it), lock `lockPercent` of the bought tokens for the creator via `lockFor`,
  send the rest to the creator. (`predictVault(predictedToken)` cannot be
  passed at launch: the Pons token address is CREATE2-derived from the curve's
  constructor args, which include the recipient — a circular dependency.)
  Event `Launched(token indexed, vault indexed, creator indexed, devBuyEth,
  lockedAmount, lockSecs)`.

## Repo layout (`C:/tech/Clasp`, WSL `/mnt/c/tech/Clasp`)

```
contracts/        Foundry project (src/, test/, script/), fork tests vs Robinhood mainnet
packages/sdk/     @clasp/sdk: ABIs (generated from forge out/), addresses, TS math mirror
apps/api/         Fastify + Postgres + viem: indexer, keeper, read API, image upload
apps/web/         Next.js 15.5.26 + React 19.1.9 + wagmi/viem, Clasp's own wallet picker (EIP-6963)
docs/             SPEC.md (this), RUNBOOK.md, SECURITY.md
```

Toolchain in WSL: node `/opt/node/bin/node` (v24, runs `.ts` directly),
`corepack pnpm`, Foundry `~/.foundry/bin/forge`.

## Read API (served by apps/api at `https://api.clasp.fun`)

All amounts are decimal strings in wei / base units.

- `GET /health` → `{ ok, block, chainId }`
- `GET /api/stats` → `{ coins, lockedValueEth, paidToLockersEth, fees24hEth, lockers }`
- `GET /api/coins?sort=new|earning|locked|lockers&search=&limit=&offset=` →
  `{ coins: CoinSummary[] }`
- `GET /api/coins/:token` → `CoinDetail` (summary + terms + vault state +
  `feeRecipientOk` + `adminRedirectPending: { newRecipient, executableAt } | null`
  + `apr` from realised fees in the last 7 days + price/market cap from Pons)
- `GET /api/coins/:token/lockers` → `Locker[]`
- `GET /api/coins/:token/activity` → recent locks/claims/unlocks/fees
- `GET /api/wallet/:address` → `{ positions: Position[], totals: { pending, claimed, lockedValueEth } }`
- `GET /api/leaderboard?board=earners|coins|longest` → rows
- `POST /api/images` (multipart, ≤2 MB png/jpg/gif/webp) → `{ url }` (served
  from `/img/<sha256>.<ext>`), used for the Pons `logo` field on launch.

`CoinSummary`: `{ token, vault, name, symbol, image, creator, priceEth,
marketCapEth, totalLocked, totalWeight, lockers, paidToLockers, apr, graduated,
createdAt }`. `Position`: `{ vault, token, symbol, image, id, amount, weight,
multiplierBps, lockStart, lockEnd, pending, claimed, matured,
earlyUnlockBurn }`.

Transactions from browser wallets are built **in the browser** with viem/wagmi
against the SDK ABIs; the API never holds those users' keys. The exception is
**Google login**: the API creates and holds a wallet per Google account
(custodial), signs for it via `POST /custody/send`, and offers `POST /custody/export`.
Auth endpoints: `GET /auth/session` → `{ enabled, user: { address, email } | null }`,
`GET /auth/google/start?return=/path`, `GET /auth/google/callback`, `POST /auth/logout`.
Details and threat model: SECURITY.md, *Custodial Google wallets*.

## Keeper (in the indexer process)

Every minute: `harvest()` vaults whose Pons escrow balance exceeds a threshold
(backoff when nothing arrives), `unlock()` matured positions — largest weight
first within each vault, round-robin across vaults with a carried-over cursor so
no vault or dust position starves another, each unlock simulated first —
`claimTreasury()` hourly per vault above a threshold. Refuses to send
below a minimum own balance. Watches `CreatorFeeRecipientChangeProposed` on
the Pons factory and records it for the coin page warning.

## Honesty rules for all copy

- Contracts are immutable; there is no upgrade key and no admin path to
  locked coins or rewards.
- **Google login is custodial**: Clasp holds the key of every Google wallet.
  Say so wherever Google login is offered and on the security page.
- **Pons's admin can redirect a coin's creator fees after a 3-day public
  timelock.** Say so on the coin page and the security page; show a warning
  banner if a redirect is pending.
- No external audit yet. Pons describes its v2 contracts as unaudited.
- Memecoins can go to zero; a coin with no trading pays nothing.
- Talk only about Clasp, Pons and Robinhood Chain: no references to any other
  product or chain.
