# Clasp — security notes

Status: **not audited.** The Pons v2 contracts Clasp builds on are also unaudited
(Pons says so). Everything below was checked against the verified Robinhood Chain
sources and exercised in fork tests against mainnet state (block ≈ 72.5M,
September 2026); `[INFERENCE]` marks anything that was not directly observed.

## Contracts at a glance

| Contract | Holds | Admin |
|---|---|---|
| `ClaspVault` (one per coin, CREATE2 salt = token) | the coin's locked tokens and its ETH rewards | **none** — no owner, no upgrade, no pause |
| `ClaspFactory` | nothing | `Ownable2Step` owner: defaults/treasury for *future* vaults, pause `createVault` |
| `ClaspRouter` | nothing between transactions | none |
| `ClaspLauncher` | nothing between transactions | none |

No proxies, no `delegatecall`, no `selfdestruct`. Vault terms, token, treasury and
Pons addresses are `immutable` in each vault's bytecode; a vault never reads the
factory after its constructor.

## What the factory owner can and cannot do

Can:
- `setDefaults(Terms)` — terms for vaults created **after** the call. Bounded by
  constants: treasury share ≤ 20% (`lockerShareBps ≥ 8000`), `penaltyBps ≤ 50%`,
  `minPenaltyBps ≤ penaltyBps`, size bonuses non-decreasing and ≤ +100%,
  `0 < minLockSecs < maxLockSecs ≤ 5 years`, `minLockSecs ≤ 7 days`,
  `0 < streamSecs ≤ min(7 days, minLockSecs)`, `0 < minLockAmount ≤ 1,000 tokens`.
  The last two bounds stop an owner from making locking impossible or pointless:
  a vault with no lockers releases the lockers' share to the treasury, which would
  otherwise turn the 20% cap into 100%.
- `setTreasury(addr)` — treasury for vaults created after the call.

Because both can change at any moment (including right before a user's
transaction), the user's side pins them: `ClaspLauncher.launch` reverts
`TermsMismatch`/`TreasuryMismatch` unless the new vault's
`keccak256(abi.encode(terms()))` and `treasury()` equal the `expectedTermsHash` /
`expectedTreasury` the user signed (the web passes `factory.defaultsHash()` and
`factory.treasury()`), and it checks this before handing the Pons fee recipient to
the vault. `createVault(token, expectedTermsHash)` reverts `TermsMismatch` on a
non-zero hash that differs from `defaultsHash()`. Attaching an existing coin is
two steps (`createVault`, then the recipient's `transferCreatorFeeRecipient`), so
the recipient must check the vault's `terms()` and `treasury()` before the second
step. Tests: `test_launch_refusesChangedTermsOrTreasury`, `test_createVault_termsPin`,
`test_setDefaults_validation`.
- `setPaused(bool)` — blocks `createVault` only (and therefore `ClaspLauncher.launch`).
- Transfer ownership (two-step) or renounce it.

Cannot:
- change any existing vault's terms, treasury, token or Pons addresses;
- pause, freeze or upgrade a vault, the router or the launcher;
- move, burn or redirect any locked token or any ETH in any vault;
- change who a position belongs to, its lock end, weight or rewards;
- move a coin's Pons creator-fee recipient (vaults have no function that calls
  `transferCreatorFeeRecipient`; once a vault is the recipient only the Pons
  admin override below can move it).

## Threat model

Assets: tokens locked in a vault; ETH that has arrived in a vault (rewards owed to
lockers, the treasury share, `owed[]` balances).

| Actor | Trust | Can do |
|---|---|---|
| Locker (position owner) | untrusted | lock, `increase`/`extend`/`claim`/`earlyUnlock` **own** positions |
| Anyone / keeper | untrusted | `unlock` matured positions (pays the owner only), `harvest`, `sync`, `claimTreasury` (pays the treasury only), `lockFor` someone else, trade via the router |
| Trader | untrusted | router `buy`/`sell` with their own `minOut` and `deadline` |
| Clasp factory owner | semi-trusted | see above — future vaults only |
| Pons owner Safe `0x263ed295dAFaE1d9AAdD6E56c4B6F9f38eE019Dd` (2-of-3) | trusted by every Pons coin | redirect a coin's creator fees after a 3-day timelock; change fee policy for future launches; rescue stuck fees; owns the hook |
| Pons fee-sweep operator `0xa1018c1D9655292A2dE0F7dEa9a0F848EaA8cA83` | trusted by every Pons coin | sweeps (and converts) post-graduation hook fees |
| Pons contracts | trusted for fee *delivery* only | the vault never approves or sends anything to them; they can only send ETH in or stop sending |
| Clasp API (Google wallets) | trusted by Google-login users only | holds every Google wallet's key (AES-256-GCM under `CUSTODY_MASTER_KEY`); signs whatever the signed-in session asks; can do anything with those wallets — see *Custodial Google wallets* |

What an attacker cannot do (enforced + tested):
- **Snipe an arrival.** ETH is released to lockers linearly over `streamSecs`
  (1 h). Weight added after ETH arrived only shares what is released *after* it
  joined. Every token entering a position is locked for at least `minLockSecs`
  (4 h, ≥ `streamSecs`): fresh locks by `_checkDuration`, top-ups because
  `increase` reverts `InvalidDuration` when less than `minLockSecs` remains
  (`test_increase_requiresMinLockRemaining`). The **principal burn (≥ 5%) is the
  early-exit deterrent**; rewards already claimed are never clawed back (an owner
  can `claim` right before `earlyUnlock`), and only unclaimed rewards are forfeited
  back into the stream. Tests:
  `test_stream_weightAddedAfterReleaseEarnsNothing`,
  `test_stream_weightAddedMidStreamEarnsOnlyTheRemainder`,
  `test_stream_sameBlockSniperCannotExtractIt`.
- **Grief another position.** `increase` and `extend` reprice a position, so they
  are owner-only (a third-party top-up could otherwise cut someone's multiplier).
  `unlock` by a third party only works after maturity and pays the owner.
- **Block payouts with a reverting receiver.** Every vault ETH payout is a `call`;
  if it reverts, the amount is credited to `owed[recipient]` and the recipient can
  later `withdrawOwed(to)` to any address. Token transfers use the plain Pons
  ERC-20 (no hooks). Tests: `test_claim_revertingOwnerIsCreditedToOwed`,
  `test_unlock_revertingOwnerDoesNotBlockKeeper`, `test_claimTreasury_revertingTreasury`.
- **Re-enter.** Every state-changing vault, router and launcher function is
  `nonReentrant`; `receive()` does no work. Test:
  `test_reentrancyFromReceiveCannotDoubleClaim`.
- **Inflate balances with fee-on-transfer tricks.** `lock`/`increase` credit the
  measured balance delta (`test_lock_measuresReceivedByBalanceDelta`).

## Invariants

Checked after every step of a random churn (`test/invariant/VaultInvariant.t.sol`,
256 runs × 120 calls over 7 actors incl. a contract that toggles reverting on ETH:
lock / lockFor / increase / extend / claim / claimAll / unlock / earlyUnlock /
router-style ETH arrivals / escrow arrivals + harvest / time warps /
claimTreasury / withdrawOwed):

1. **Solvency:** `Σ pending(id) + undistributed + treasuryOwed + totalOwed ≤ vault.balance`.
   A one-unit over-credit mutation in the release math is caught by this invariant
   (verified by temporarily mutating `_previewRelease`).
2. `totalWeight == Σ position.weight` and `totalLocked == Σ position.amount ==
   token.balanceOf(vault)` (no direct token donations in the run).
3. `positionsOf` lists every open position exactly once; `totalOwed == Σ owed`.
4. `sync()` never finds an unrecorded outflow: only vault code moves ETH out and
   every outflow decrements the recorded balance first; a drop below it reverts
   `UnrecordedOutflow`.

Rounding always favours solvency: `accRewardPerWeight` (scaled 1e18) rounds down and
carries the division remainder into the next release, so lockers are never
credited more than was released and rounding never loses ETH (it only defers
< `totalWeight / 1e18` wei); per-position sub-wei residue stays in the position;
early-exit burns round up; the blended `lockStart` rounds toward a larger penalty.

Token flows out of a vault: only to the position owner (`unlock`, `earlyUnlock`) and
to `0x000000000000000000000000000000000000dEaD` (early-exit penalty).
ETH flows out of a vault: only to position owners (claims), the vault's immutable
treasury (`claimTreasury`), and `withdrawOwed` destinations chosen by the owed
account itself.

## Pons integration

Sources: verified contracts on Robinhood Chain (Blockscout / Sourcify), compiler
0.8.35. Line numbers refer to the verified files.

### Addresses and live configuration (read on-chain, block ≈ 72,486,000)

| | |
|---|---|
| `PonsV2LaunchFactory` | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`, owner Safe `0x263ed295dAFaE1d9AAdD6E56c4B6F9f38eE019Dd` |
| `PonsV2FeeEscrow` | `0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e` |
| `PonsV2LaunchDeployer` | `0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42` |
| `PonsV2LaunchAndBuy` (factory `launchForwarder`) | `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948` |
| `PonsV2MemeHook` | `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044`, owner = the same Safe |
| Uniswap v4 `PoolManager` | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| v4 `PositionManager` | `0x58daec3116aae6D93017bAAea7749052E8a04fA7` |
| `PonsV2BuybackVault` | `0x42df2a798f82289E177311362e8f5ccC45c1219c` |
| `launchEnabled` / `launchFee` | `true` / 0.0005 ETH |
| launch config 0 (only one) | supply 1e27, `curveFeeBps` 100, `phantomQuote` 1.68 ETH, `graduationThreshold` 4.2 ETH, `poolFee` 0, `tickSpacing` 200 |
| hook fee policy | protocol share 30%, buyback 50% of the creator slice (only if enabled), hook fee 1%, max internal impact 3% |
| snipe tax | 99% at the launch second, halving 14 times over **3 s** |
| `maxCreatorTaxBps` | 1000 (10%) |

### Launching (`PonsV2LaunchFactory.sol`)

- `TokenParams` (lines 109–158): `name, symbol, logo, description,
  socials{twitter,telegram,discord,website,farcaster}, creatorFeeRecipient,
  creatorTaxBps (uint16), buybackEnabled, expectedEconomics (bytes32), salt (bytes32)`.
- `launchToken(TokenParams, uint256 launchConfigId, address pairToken) payable
  returns (address token, address curve)` (696–703); an overload adds
  `address[] snipeTaxExemptions` (713–721). `msg.value` must equal `launchFee`
  exactly (767); `canLaunch(msg.sender)` = `launchEnabled || whitelisted` (456, 766).
  `creatorFeeRecipient == 0` defaults to the caller (813–814). The caller and the
  recipient are exempt from the snipe tax (844–847).
- `PonsV2LaunchAndBuy.launchAndBuy(params, configId, pairToken, quoteIn,
  minTokensOut, recipient, snipeTaxExemptions)` calls `launchTokenFor` with
  `originalDeployer = msg.sender` (LaunchAndBuy 114–172). ClaspLauncher does not use
  it: it calls `launchToken` directly and buys on the curve itself.
- **Why the launcher cannot pass `predictVault(token)` as the recipient:** the
  token address is CREATE2 from `keccak256(abi.encode(originalDeployer, salt))`
  (LaunchDeployer 138–140) over a creation code that includes the curve address
  (170–185), and the curve's creation code includes `creatorFeeRecipient`
  (146–164). The vault address is CREATE2 over the token, so it cannot be an input
  to the token's own address. ClaspLauncher therefore launches with itself as
  recipient, creates the vault and calls `transferCreatorFeeRecipient(token, vault)`
  **before any trade** in the same transaction, then does the dev buy. Consequence:
  Pons records ClaspLauncher as the coin's `deployer` (the real creator is in
  ClaspLauncher's `Launched` event), and ClaspLauncher is snipe-tax exempt for its
  own dev buy. ClaspLauncher namespaces the user salt with `msg.sender`.

### Launch record (`ILaunchpadV2.sol` 101–137)

`getLaunchedToken(token)` returns `LaunchedToken{token, curve, deployer,
creatorFeeRecipient, pairToken, graduationThreshold, poolFee (uint24), tickSpacing
(int24), creatorTaxBps (uint16), buybackEnabled, phase (NotGraduated | Swept |
PoolCreated | Rescued), sweptQuote, sweptTokens, sweptAt, exists}`. There is no
stored `poolId`; it is `keccak256(abi.encode(PoolKey))` with
`PoolKey{currency0: address(0) (native ETH sorts first), currency1: token, fee:
poolFee, tickSpacing, hooks: PonsV2MemeHook}` (factory `_poolIdFor` 1062–1072,
`_sortCurrencies` 1446). Verified: Pyre's pool id
`0x46d3902d85b818e03901676f3898177936e08b4c30de4d1c2dd6fea80bb0fe32` is registered
in the hook, and the fork tests assert `hook.launches(poolId).registered` for the
key Clasp builds.

### Creator fee recipient

- `transferCreatorFeeRecipient(token, newRecipient)` (888–894): only the current
  recipient; takes effect immediately; forwards to the curve (pre-graduation,
  `curve.deployer = newRecipient`) or the hook pool (post-graduation) and to the
  buyback vault (`_setCreatorFeeRecipient` 988–1006). Works in every phase.
- `setBuybackEnabled(token, enabled)` (904–921): recipient may enable or disable;
  the Pons owner may only disable. A vault that is the recipient disables it during
  `harvest()` if it was ever turned on.

### Fee escrow (`PonsV2FeeEscrow.sol`)

`_balances[recipient]` (line 32) — **native-ETH balances are per recipient**,
aggregated over every launch that pays that recipient; ERC-20 balances are per
(recipient, token) (33). `claim()` pays `msg.sender` its whole ETH balance and
**reverts `NoBalance` at zero** (71–73, 107–118), so `harvest()` checks
`balanceOf(vault)` first. One vault per coin keeps each vault's escrow balance
attributable to exactly one coin.

### Where creator fees sit before they reach the escrow

- **Bonding curve** (`PonsV2BondingCurve.sol`): each trade accrues `feeBps` (1%)
  and `creatorTaxBps` of the ETH leg into `quoteFeeBalance`/`creatorTaxBalance`
  (`_accrueFees` 711–718). Nothing reaches the escrow until `sweepFees(minOut)`
  (579–587), callable by the Pons operator **or the current recipient**
  (`deployer`), and only by the recipient if no buyback slice is earmarked;
  `_sweepFees` (741–822) credits the recipient `fee − 30% + tax`. `graduate()` also
  sweeps (598–638). `ClaspVault.harvest()` calls `sweepFees(0)` as the recipient,
  then `FeeEscrow.claim()`. Fork-verified: the harvested amount equals
  `quoteFeeBalance·0.7 + creatorTaxBalance` exactly.
- **v4 hook pool** (`PonsV2MemeHook.sol`): `afterSwap` (444–485) takes
  `hookFeeBps + creatorTaxBps` of the swap's *unspecified* currency — the output
  of an exact-input swap. Buys (ETH→token) therefore accrue fees in the
  **memecoin**, sells in ETH. `sweepPoolFees(poolId, minConversionQuoteOut,
  minBuybackTokensOut)` (500–531) is callable by the operator or the pool's
  creator, but the creator only when no memecoin fees and no buyback earmark are
  pending (`_requiresTrustedOperator` 611–617). In practice the Pons operator
  converts and sweeps; `harvest()` tries the creator sweep (failure ignored) and
  claims whatever the escrow holds. Fork-verified on a freshly graduated coin and
  on Pyre: the creator sweep is refused while memecoin fees are pending, the
  operator sweep credits the vault, the next `harvest()` pulls it in.
- Pons owner rescue paths (`rescueCurveFees`, hook `rescuePoolFees`) pay the
  creator directly: ETH lands in the vault and is counted as inflow; memecoin
  rescued from a hook would sit in the vault undistributed (see limitations).

### Trading paths used by ClaspRouter

- **Curve** (pre-graduation): `buy(quoteIn, minTokensOut, recipient) payable`
  (438–520; `msg.value == quoteIn`; fee + creator tax + snipe tax off the input;
  a buy past the sellable allocation is clamped and the rest refunded to
  `msg.sender`; `minTokensOut` becomes a price bound on clamped fills) and
  `sell(tokensIn, minQuoteOut, recipient)` (541–566; fee + tax off the output;
  closed once `readyToGraduate`). Pricing: constant product on
  `getReserves() = (phantomQuote + trackedQuote − pending fees, trackedTokens)`
  (368–371, `PonsV2BondingCurveMath`). `quoteBuy`/`quoteSell` mirror this exactly
  (fork: quote == fill), except that `quoteBuy` ignores the snipe tax
  (`currentSnipeTaxBps(recipient)`, 315–323) which only exists in the first 3 s.
- **Graduation:** the buy that exhausts the sellable allocation auto-calls
  `factory.graduate` (curve 696–703) → phase `Swept`; anyone then calls
  `createGraduatedPool(token)` (factory 1193–1211) → `PoolCreated`. ClaspRouter
  reverts `NotTradeable` in `Swept` and `Rescued` (fork-tested).
- **v4 pool** (post-graduation): ClaspRouter implements `IUnlockCallback` and swaps
  directly on the PoolManager (`unlock` → `swap` exact-input with the extreme price
  limit → `sync`+`settle` the input, `take` the output), mirroring the hook's own
  settlement (hook 774–829). The returned delta already has the hook's cut taken.
  Output is checked against `minOut`; unused input (price-limit partial fill) is
  returned. Quotes for graduated coins are computed from the pool's current
  `sqrtPrice`/in-range liquidity, LP + protocol fee and the hook cut; they are exact
  while the swap stays inside the current liquidity range (fork: exact for a fresh
  pool and for Pyre) and an estimate otherwise (anyone may add concentrated
  liquidity: the hook has no `beforeAddLiquidity` gate, 184–201).
- **Which router the Pons site uses** for graduated swaps is not determinable from
  chain data alone. Swaps on Pyre's pool over the last ~2M blocks came from the
  hook itself (internal conversions), a 0x Settler (`RobinHoodSettler`
  `0x6aa80dbbed9ae5ab45fbf61f9644fada3b29326e`), `UniversalUniswapV4Adapter`
  `0x36dc95f1f088e11c0066dc19173f745655002bc2`, Uniswap `UniversalRouter`
  `0x8876789976decbfcbbbe364623c63652db8c0904` and others. `[INFERENCE]` The Pons
  site most likely uses the Uniswap UniversalRouter. ClaspRouter depends on none of
  them.

### Pons admin redirect risk (must be surfaced to users)

`setCreatorFeeRecipient(token, newRecipient)` (946–957) lets the **Pons owner Safe
redirect any coin's creator fees**, including a Clasp vault's, after
`CREATOR_FEE_RECIPIENT_TIMELOCK = 3 days` (99); anyone may then execute it during a
further 3-day window (`executeCreatorFeeRecipientChange` 964–974, 107). It cannot be
disabled, and a creator transfer during the timelock does not cancel it (comment
933–945). Signals: event `CreatorFeeRecipientChangeProposed(token, currentRecipient,
proposedRecipient, effectiveAt, expiresAt)` and view
`pendingCreatorFeeRecipient(token)`.

**This power is in active use.** Transaction
`0xd51a1855e404c00b5658d87b989598a1b9851ec372e0949df00dcf783de7c4f2` (block
72,334,430) proposed redirects for five coins at once (e.g. token
`0xd79eb5d4edf7bd843eef5109f1a1ff5c96b17948` → `0x281a4afde052e69f06e9d2de534240412bf39f0a`,
`effectiveAt` 1790609329, `expiresAt` 1790868529); at block ≈ 72.5M they were
still pending.

If a redirect executes against a Clasp vault: already-arrived ETH and all locked
tokens are unaffected; Pons creator fees stop arriving; router fees (2% of Clasp
trades) still arrive. The vault cannot undo it. Show a warning banner whenever
`pendingCreatorFeeRecipient(token).newRecipient` is non-zero and
`isFeeRecipient()` on every coin page.

## Custodial Google wallets

"Continue with Google" is **custodial**: the API creates a wallet per Google
account and keeps its private key. Browser-wallet users are unaffected (the API
never sees their keys). Code: `apps/api/src/routes/auth.ts`, `apps/api/src/custody.ts`,
`apps/web/src/lib/google-wallet.ts`.

- **At rest:** `custodial_accounts.key_cipher` is AES-256-GCM with a random
  96-bit IV per key, the checksummed-lowercase address as AAD (a ciphertext only
  opens in its own row), and the master key only in the `CUSTODY_MASTER_KEY`
  Railway variable of `api` (not in the database, not on `indexer`, not in git).
  A database leak alone does not expose keys; database + master key does.
- **Login:** OAuth 2.0 authorization code + PKCE (S256), `state` bound to an
  HMAC-signed, HttpOnly, 10-minute cookie scoped to `/auth/google`. The ID token
  comes straight from Google's token endpoint over TLS; `iss`, `aud`,
  `exp`, `email_verified` are checked. Return paths are same-site paths only.
- **Sessions:** 32 random bytes in an HttpOnly, Secure, SameSite=Lax cookie on
  `api.clasp.fun`, 30 days; only its SHA-256 is stored. Logout deletes the row.
- **Signing:** `POST /custody/send` signs exactly one transaction (`to`, `data`,
  `value`, `gas` from the request; nonce and fees filled server-side) under a
  per-wallet Postgres advisory lock. No message signing is offered, so a Google
  wallet cannot sign permits or off-chain approvals. Every send is in `custody_log`.
- **CSRF:** SameSite=Lax plus an `Origin` allow-list (`CORS_ORIGINS`) on every
  POST; CORS allows credentials for those origins only.
- **Export:** `POST /custody/export` returns the key only within 15 minutes of a
  fresh Google login (a stolen long-lived cookie cannot export), 5/hour, logged.
- **What this does not protect against:** a compromised Google account; a
  compromised `api` service or Railway account (master key + database); a
  malicious or buggy API deploy. Stolen sessions can send transactions (not
  export) until they expire or the user logs out.
- **Rotation:** `key_version` is stored per row; rotating `CUSTODY_MASTER_KEY`
  needs a re-encryption job (not written yet) — never change the variable without
  one, or every Google wallet becomes unreadable.

## Known limitations

- **Unaudited**, on top of unaudited Pons v2.
- **Fee delivery depends on Pons.** Post-graduation memecoin-denominated hook fees
  reach the vault only after the Pons operator sweeps them. The Pons owner can
  redirect creator fees (above) or change fee policy for future launches.
- **Coins registered before the recipient moves** (`createVault` does not require
  it) earn only router fees until the current recipient calls
  `transferCreatorFeeRecipient(token, vault)`; `isFeeRecipient()` tells.
- **Buyback history.** `createVault` refuses coins whose buyback flag is on, but a
  coin that had buyback on earlier may still have a `PonsV2BuybackVault` vest
  (`totalLocked(token) > 0`); its creator share follows the recipient, so future
  releases would send memecoin to the vault, where it stays undistributed. Check
  before transferring the recipient.
- **Stray tokens** sent to a vault outside `lock` (donations, memecoin rescues or
  vest releases above) cannot be recovered or distributed — there is deliberately
  no sweep function. Plain ETH sent to a vault is treated as fee inflow (90/10).
- **Stream semantics.** Arrivals are pooled into one linear stream; a new arrival
  restarts the window for everything still undistributed (Synthetix-style), so
  release can take longer than `streamSecs` under continuous inflow. Weight that
  joins mid-stream shares the remainder of the stream (by design, bounded by the
  4 h minimum lock, which top-ups also respect, and the early-exit burn).
- **Matured positions keep earning until unlocked.** A position's weight leaves
  `totalWeight` only in `unlock`/`earlyUnlock`. After `lockEnd` it keeps its full
  multiplier (up to 4× duration × 1.5 size) and keeps earning, although its owner
  can leave at any moment — this dilutes lockers who are still committed. Anyone
  may `unlock` a matured position (tokens and rewards go to the owner only); the
  Clasp keeper (`apps/api/src/keeper.ts`) does so every minute, **largest weight
  first within each vault and round-robin across vaults** (cursor carried between
  ticks), so dust positions cannot hold a large one back in the queue. Each unlock
  is simulated first; one that reverts or estimates above `UNLOCK_MAX_GAS` (e.g. a
  gas-burning `receive`) backs off 1 h → 24 h. A holder who stays matured is
  exposed to the keeper at any time, but between keeper passes (or if the keeper is
  down or out of funds, which raises a `keeper_low_balance` alert) the gap is real.
  An on-chain fix (settling rewards at `lockEnd`) was considered and not shipped:
  it needs `accRewardPerWeight` at an arbitrary past time, which requires a
  per-transaction history of stream parameters plus a search on unlock, or
  scheduled weight expiry with unbounded catch-up loops; neither is simple enough
  to add without an audit, and a bucketed approximation would short honest
  short-lock holders by up to a bucket of rewards.
- **Size tier** is evaluated against `totalSupply()` when a position is created,
  increased or extended, never retroactively.
- **Early exit** burns by transfer to `0x…dEaD` (does not reduce `totalSupply()`).
  The burn is the whole deterrent: claimed rewards are not clawed back, so
  `claim` then `earlyUnlock` keeps every reward earned so far. Only rewards still
  unclaimed at exit are forfeited and re-streamed; if the exiting position was the
  last one, they are released to the treasury.
- **Router quotes** ignore the Pons snipe tax (first 3 s after launch, up to 99% of
  the buy; buyers should wait or check `curve.currentSnipeTaxBps(buyer)`);
  graduated quotes are estimates beyond the current liquidity range. Execution is
  always bounded by `minOut`/`minEthOut` and `deadline`.
- **Dev buy** through ClaspLauncher pays Pons fees but no Clasp router fee.
- **Gas estimation.** Vault cost depends on elapsed time (stream release writes and
  zero→non-zero storage flips); estimates taken at the previous block can be tens of
  thousands of gas short. Wallets/keepers should add headroom (×1.5).
- **Gas griefing by recipients.** Payouts forward all gas; a recipient contract that
  burns gas in `receive` only hurts transactions paying it (its own claims, or a
  keeper's `unlock` of its matured position — keepers should simulate first). It can
  never block other positions.
- **`lockFor` spam.** Anyone can open positions for any owner (≥ 1 whole token
  each). That can only lengthen the owner's `positionsOf` list (a view); claims take
  explicit ids.
- **L2 `block.number`.** Nothing in Clasp uses `block.number` (only timestamps); on
  Robinhood Chain it returns the L1 block number.
- **EVM target.** Compiled with solc 0.8.26 for `cancun` (PUSH0, MCOPY, TSTORE).
  Checked with raw `eth_call`s on the live RPC: MCOPY and PUSH0+TSTORE/TLOAD
  bytecode executes, an INVALID opcode errors.

## Verification performed

- `forge test` (unit + fuzz + invariant; fork suite skipped without an RPC URL),
  re-run after the internal review fixes (factory term bounds + launch/createVault
  pins, `increase` minimum-lock rule); the fork launch path passes the pinned
  `defaultsHash()`/`treasury()`, and the Pyre attach uses `createVault(PYRE,
  defaultsHash())`.
- `ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com forge test --match-path 'test/fork/*'`:
  launch through ClaspLauncher on the real factory, curve buy/sell through the
  router (2% to the vault, quotes exact), lock, `harvest()` sweeping curve fees via
  the escrow, claims, treasury claim, early exit to `0x…dEaD`, matured third-party
  unlock; buying a fresh coin through graduation, `createGraduatedPool`, v4 buy/sell
  through the router, operator sweep + harvest; attaching Pyre by impersonating
  its current recipient and trading/harvesting it.
- `script/Deploy.s.sol` dry-run on a local anvil fork of mainnet: ClaspFactory
  5,135,924 gas, ClaspRouter 2,678,574, ClaspLauncher 970,682 (total 8,785,180);
  the deployed factory reported the live Pons factory/escrow/hook, and
  `createVault(Pyre)` (2,846,991 gas) landed at `predictVault(Pyre)`.
