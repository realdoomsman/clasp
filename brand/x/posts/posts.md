# Clasp — 20 launch posts for @ClaspFun

All numbers come from the Clasp production brief or are computed from its formulas (math shown where it is computed). No emoji, no hashtags. Media files live next to this file (`post-NN.png`) or in `../video/` for the four clips. Images are 1600×900 PNG except post 08 (1080×1350 portrait).

Rules kept in every post: only Clasp, Pons and Robinhood Chain are named; no price talk, no return promises; risks stated where relevant (not audited, Pons v2 unaudited, Google sign-in custodial, Pons admin redirect, memecoins can go to zero, no trading = no fees).

---

## 01 — The problem

- **Type:** comparison to the status quo (no competitors named)
- **Media:** `post-01.png`

```text
On a typical memecoin, every trade pays a creator fee, and all of it goes to one wallet.

The holders who make the volume get nothing from it.

Clasp sends that stream to the people who lock the coin: 90% to lockers, paid in ETH.

clasp.fun
```

**Alt text:** Side-by-side diagram. Left, "A typical memecoin": every trade → creator fee → one wallet, the creator; holders who create the volume earn 0. Right, "A Clasp coin": every trade → the coin's vault → lockers by weight; 90% to lockers, 10% to the Clasp treasury, 0% to the creator.

---

## 02 — The 90/10/0 split

- **Type:** stat
- **Media:** `post-02.png`

```text
Where every fee on a Clasp coin goes:

90% to lockers
10% to the Clasp treasury
0% to the creator

The coin's Pons creator fees and Clasp's 2% trading fee both land in the coin's vault. The split is written into the vault when it is created and can't be changed.
```

**Alt text:** Three large figures on white cards: 90% Lockers (shared by weight, paid in ETH, collect any time), 10% Clasp treasury (also receives the lockers' share if no one is locked), 0% Creator (earns only by locking). A bar below shows the 90/10 proportion.

---

## 03 — How the money moves

- **Type:** how it works (video)
- **Media:** `../video/clip-money-flow.mp4`

```text
How the money moves on a Clasp coin.

Buys and sells through Clasp pay 2% of the ETH side. The coin's Pons creator fees point at its vault too.

Everything that arrives streams to lockers over 1 hour. 90% lockers, 10% treasury, 0% creator.
```

**Alt text:** n/a (video). Suggested video description: Animated diagram of a buy or sell paying Clasp's 2% fee and Pons creator fees into the coin's vault, then streaming out over one hour: 90% to lockers, 10% to the Clasp treasury, 0% to the creator.

---

## 04 — Lock length multiplier

- **Type:** education (chart)
- **Media:** `post-04.png`

```text
Lock length sets your multiplier.

4 hours: 1.000×
1 day: 1.143×
1 week: 1.411×
30 days: 1.858×
90 days: 2.489×
180 days: 3.106×
1 year: 4.000×

Square-root curve: 1 + 3·√((t − 4h)/(1y − 4h)). Computed on-chain in basis points, frozen into each vault.
```

**Alt text:** Line chart of the duration multiplier against lock length from 0 to 1 year. The square-root curve rises steeply at first and flattens toward 4.0×. Labelled points: 1.858× at 30 days, 2.489× at 90 days, 3.106× at 180 days, 4.000× at 1 year. A strip below lists all seven values from 1.000× at 4 hours to 4.000× at 1 year, next to the formula.

---

## 05 — Size bonus

- **Type:** education (table)
- **Media:** `post-05.png`

```text
Size counts too.

One lock holding at least 0.1% of the supply gets +10% on its multiplier. 0.5% gets +25%. 1% gets +50%.

The two multiply. A 1-year lock of 1% or more reaches the ceiling: 4.000 × 1.50 = 6.0×.
```

**Alt text:** Table of combined multipliers. Rows are one lock's share of total supply (under 0.1%, 0.1% or more, 0.5% or more, 1% or more) with size bonuses none, +10%, +25%, +50%. Columns are lock lengths 1 week, 30 days, 90 days, 1 year. Values run from 1.411× to 6.000×; the 6.000× cell (1% or more, 1 year) is highlighted.

---

## 06 — Worked example

- **Type:** technical (formula card)
- **Media:** `post-06.png`

```text
The share math, with numbers (illustrative, 1B-supply coin):

A locks 2M coins for 1 year: 2M × 4.000 × 1.10 = 8.8M weight
B locks 10M coins for 1 week: 10M × 1.411 × 1.50 = 21.165M weight

Total 29.965M. A gets 29.37% of what lockers receive, B gets 70.63%. Per 1 ETH arriving: A 0.2643 ETH, B 0.6357 ETH.

A has a fifth of B's coins and still takes 29.37%.
```

**Alt text:** Formula card with two lockers. Locker A: 2,000,000 coins × 4.000 (1 year) × 1.10 (size) = weight 8,800,000. Locker B: 10,000,000 × 1.411 (1 week) × 1.50 = weight 21,165,000. Total weight 29,965,000. A bar splits shares 29.37% and 70.63%; per 1 ETH arriving, 0.90 ETH goes to lockers: A 0.2643 ETH, B 0.6357 ETH.

---

## 07 — Weight in motion

- **Type:** education (video)
- **Media:** `../video/clip-lock-weight.mp4`

```text
Your share of every fee = your weight ÷ everyone's weight.

Weight = amount × duration × size.

Two people lock the same amount. One picks 1 year (4.000×), the other 1 week (1.411×). The 1-year lock gets 73.9% of every arrival; the 1-week lock gets 26.1%.
```

**Alt text:** n/a (video). Suggested video description: The duration curve from 1.000× at 4 hours to 4.000× at 1 year, the size bonus steps, and two equal locks of 1 year and 1 week splitting each arrival 73.9% / 26.1%.

---

## 08 — Launch with the vault built in

- **Type:** feature (annotated screenshot, portrait)
- **Media:** `post-08.png`

```text
Launching a coin on Clasp is one transaction.

It creates the coin on Pons, creates its Clasp vault, points the creator fees at the vault before anyone can trade, makes your first buy and can lock part of it.

Launch gas measured on mainnet: ≈ 0.000245 ETH.
```

**Alt text:** Portrait graphic with a real screenshot of the clasp.fun launch form. Three numbered callouts: 1, "You buy first, in the same transaction, before anyone else can"; 2, a slider to lock part of the first buy (50% shown); 3, lock length buttons from 4h to 1y with 1 year selected. Below: rules frozen in the vault (90% lockers, 10% Clasp, 0% creator) and launch gas ≈ 0.000245 ETH.

---

## 09 — One-hour stream, collect any time

- **Type:** how it works (diagram)
- **Media:** `post-09.png`

```text
Two details that matter.

Fees don't land all at once. Each arrival is released to lockers linearly over 1 hour, so locking right after a big fee doesn't let you take it.

And you never have to unlock to get paid. ETH builds up continuously; collect it whenever you want. A claim costs ≈ 0.000004–0.000006 ETH in gas.
```

**Alt text:** Chart of one fee arrival released linearly from 0% to 100% over 60 minutes. A dashed line at minute 30 marks a new lock: the first half went to earlier lockers, the new lock shares only the second half. Side cards: "No sniping a big fee", "Collect any time: your coins stay locked", and claim gas ≈ 0.000004–0.000006 ETH.

---

## 10 — Bring an existing Pons coin

- **Type:** use case (steps + screenshot)
- **Media:** `post-10.png`

```text
Already launched on Pons? Two steps to bring the coin to Clasp:

1. Create its vault. Anyone can, and it only costs gas.
2. The coin's current creator-fee recipient points its Pons creator fees at the vault.

From then on, those fees go to the people who lock it. Works for ETH-paired Pons v2 coins with buyback off.
```

**Alt text:** Two numbered step cards: 1, create the coin's vault (anyone can, costs only gas); 2, point creator fees at the vault (done by the coin's current creator-fee recipient on Pons). Beside them, a real screenshot of the "Bring your coin to Clasp" section of clasp.fun/launch with a coin address field.

---

## 11 — Leaving early

- **Type:** education (video)
- **Media:** `../video/clip-early-exit.mp4`

```text
You can leave a lock early. It costs coins.

Burn = max(5%, 25% × time left ÷ lock length). 25% at the start, falling to the 5% floor once 80% of the lock has passed.

Burned coins are gone for good. ETH you've collected stays yours; uncollected ETH goes to the other lockers.
```

**Alt text:** n/a (video). Suggested video description: The early-exit burn falling from 25% at the start of a lock to a 5% floor from 80% of the way through, burned coins going to the dead address, and a note that a minutes-old 4-hour lock burned ~24.8% in our mainnet test.

---

## 12 — The keeper bot

- **Type:** technical (diagram)
- **Media:** `post-12.png`

```text
Clasp runs a keeper bot for the chores:

harvest() pulls Pons creator fees into vaults
unlock closes ended locks, largest first
claimTreasury() sends the treasury's 10%

All permissionless, and the bot only spends its own gas. Unlocked coins and ETH go only to the lock's owner.
```

**Alt text:** Three cards, one per keeper job: harvest() pulls creator fees into the vault; unlock closes ended locks, largest first, with coins and ETH going only to the owner; claimTreasury() sends Clasp's 10% to the treasury. A green note says that in the mainnet test the keeper ran harvest() and claimTreasury() on its own.

---

## 13 — No admin path

- **Type:** safety
- **Media:** `post-13.png`

```text
There is no admin path to locked coins or earned ETH.

No proxies. No upgrade key. Each vault writes its rules into itself when it is created.

The factory owner can change defaults for vaults created later and pause new vault creation. Nothing reaches an existing vault.
```

**Alt text:** Two lists. "The factory owner can only": change defaults for vaults created later (rules, treasury address); pause the creation of new vaults. "Nobody, including Clasp, can": move locked coins, move earned ETH, change an existing vault's rules, swap the contract code.

---

## 14 — Your wallet or Google

- **Type:** safety (annotated screenshot)
- **Media:** `post-14.png`

```text
Two ways to sign in. Know the difference.

Your own wallet: Clasp never sees your keys. Your wallet signs every transaction.

Continue with Google: Clasp creates a wallet for you and holds its key, encrypted. That is custodial. You can withdraw ETH or export the key any time.
```

**Alt text:** Real screenshot of the "Sign in to Clasp" dialog with two callouts: 1, "Continue with Google", which the site explains creates a wallet and keeps its key; 2, "Or use your own wallet". Cards beside it label Google sign-in as custodial (withdraw or export any time) and your own wallet as "Clasp never sees keys".

---

## 15 — A quick tour

- **Type:** use case (video walkthrough)
- **Media:** `../video/clip-walkthrough.mp4`

```text
A quick tour of clasp.fun.

Open a coin, choose an amount and a lock length, see your boost. Trades on the page pay 2% to the coin's vault. Sign in with your own wallet, or with Google (custodial, export the key any time).

The coin in the video is our test coin. Not an investment.

clasp.fun
```

**Alt text:** n/a (video). Suggested video description: Screen tour of clasp.fun: the Clasp Test coin page, the lock panel with 1 year selected (4× boost), the trade panel noting the 2% fee to the vault, and the sign-in dialog with own wallet or Google.

---

## 16 — The Pons admin risk

- **Type:** safety (risk disclosure)
- **Media:** `post-16.png`

```text
One risk we can't remove, stated plainly.

Pons's admin can redirect a coin's creator fees after a 3-day public timelock. If a change is pending, Clasp shows a warning banner on that coin's page.

It can't touch Clasp's 2% fee, locked coins or ETH already earned.
```

**Alt text:** Real screenshot of the "One outside risk" note from a clasp.fun coin page, above a timeline: Day 0, change proposed and public on-chain; Clasp shows a warning banner while it is pending; Day 3, earliest it can take effect. Below: would stop that coin's Pons creator fees reaching lockers; unaffected: Clasp's 2% fee, locked coins, ETH already earned.

---

## 17 — Mainnet test

- **Type:** proof (real numbers, framed as a test)
- **Media:** `post-17.png`

```text
We tested Clasp end to end on mainnet with a throwaway coin, Clasp Test ($CLTEST), from two side wallets: launch, buy, lock, sell, harvest, claim, early unlock, sell-all. Every step succeeded.

- 0.0879 ETH reached the vault in its first hours
- 0.001305 ETH was paid to the two lockers after minutes
- The keeper ran harvest() and claimTreasury() on its own
- An early unlock burned ~24.8%, as the rule says

Context: about a dozen launch bots traded it, and most fees were their Pons launch-window tax. It's a test coin. Don't buy it.
```

**Alt text:** Headline "We ran every action on mainnet with a test coin", with green checks for launch, buy, lock, sell, harvest, claim, early unlock and sell-all. Four stat cards: 0.0879 ETH into the vault in its first hours; 0.001305 ETH paid to the two lockers after minutes; about a dozen outside wallets (launch bots) traded it; ~24.8% burned on early unlock of a minutes-old 4-hour lock. Below, a real screenshot of the test coin's stats with "Paid to lockers 0.001305 ETH" highlighted. Footer: a test coin, not an investment.

---

## 18 — Tests and verified source

- **Type:** proof (tests + contract addresses)
- **Media:** `post-18.png`

```text
How we tested Clasp:

84 unit, fuzz and invariant tests, plus 3 fork tests against live Robinhood Chain state. The invariant suite runs 256 runs × 120 random calls across 7 actors, and after every step checks that a vault never owes more ETH than it holds.

Not audited yet. Source verified on Sourcify:
Factory 0x82866AEAD0a590E5f9e7da74fC8c4FCAFFad60af
Router 0x2c2F23acbEd17827b7873Ce1Bc7430ADEB7Bf92A
Launcher 0xE9E68B421dD2dE4F6825A9D5288D00732432A7af
```

**Alt text:** Three stat cards: 84 unit, fuzz and invariant tests; 3 fork tests against live Robinhood Chain state; 30,720 random calls per invariant campaign (256 runs × 120 calls, 7 actors). A dark card reads "Checked after every call: ETH the vault owes ≤ ETH the vault holds". A list shows the ClaspFactory, ClaspRouter and ClaspLauncher addresses, each marked Sourcify verified. Note: not audited yet.

---

## 19 — Gas costs

- **Type:** stat (measured on mainnet)
- **Media:** `post-19.png`

```text
What Clasp costs in gas, measured on Robinhood Chain mainnet:

Buy ≈ 0.0000094 ETH
Lock ≈ 0.0000101 ETH
Claim ≈ 0.000004–0.000006 ETH
Launch (coin + vault + first buy) ≈ 0.000245 ETH

Trades through Clasp also pay the 2% fee, which goes to the coin's vault.
```

**Alt text:** Bar list of measured gas costs drawn to scale: launch ≈ 0.000245 ETH (coin, vault and first buy in one transaction), lock ≈ 0.0000101 ETH, buy ≈ 0.0000094 ETH, claim ≈ 0.000004–0.000006 ETH. Note: measured on Robinhood Chain mainnet during the end-to-end test.

---

## 20 — FAQ

- **Type:** FAQ
- **Media:** `post-20.png`

```text
Common questions about Clasp:

Do I need to unlock to get paid? No. Collect ETH any time.
Does the creator get a cut? No. 0%.
Can I leave early? Yes, with a burn of 5–25% of the lock.
What if nobody trades? Then there's nothing to share.
Is it audited? Not yet, and neither is Pons v2.

Memecoins can go to zero. Only lock what you can afford to lose.

clasp.fun
```

**Alt text:** Six question cards: Do I have to unlock to get paid? (No, collect any time.) Where does the ETH come from? (Pons creator fees plus Clasp's 2% fee; 90% to lockers.) Does the creator get a cut? (No, 0%.) Can I leave early? (Yes, burn max(5%, 25% × time left ÷ lock length).) What if nobody trades? (Nothing to share.) Is it audited? (Not yet; Pons v2 is unaudited too.)
