# Clasp video scripts

Final voice-over and on-screen text for every video in this folder. Voice: `en-US-AndrewMultilingualNeural` (edge-tts, rate +8%). Timestamps are when each VO line starts in the final file. Captions are burned in (lower third, Inter) and follow the VO line by line; numbers are written as digits in captions and spoken in words.

All numbers come from the Clasp brief or its formulas. The lock-weight example (73.9% / 26.1%) is computed: 4.000 ÷ (4.000 + 1.411) and 1.411 ÷ (4.000 + 1.411).

## launch.mp4 — main launch video (77.6 s, 1920×1080, 30 fps)

### cold — 0:00.0–0:06.2

On screen: “Every memecoin trade pays a fee.” Buy/Sell chips stream into a FEE gate; fee dots fly to a card: “One wallet — keeps every fee”. Holders row: “Holders — earn nothing from the volume they create”.

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:00.5 | Every meme coin trade pays a fee. | Every memecoin trade pays a fee. |
| 0:02.9 | Usually, one wallet keeps it all. Holders get nothing. | Usually, one wallet keeps it all. Holders get nothing. |

### reveal — 0:06.2–0:12.4

On screen: Clasp mark draws itself, wordmark slides out. “Lock a coin you believe in. / Earn a share of every trade.” Sub-line: “Trading fees paid in ETH to the people who lock. On Robinhood Chain.”

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:07.2 | Clasp changes that. | Clasp changes that. |
| 0:08.6 | Lock a coin you believe in. Earn a share of every trade. | Lock a coin you believe in. Earn a share of every trade. |

### how — 0:12.4–0:24.8

On screen: Header “01 How the money flows”. Diagram: “Clasp trading fee 2% of every buy or sell through Clasp” + “Pons creator fees — pointed at the vault, pulled in by anyone, or Clasp's keeper bot” → dark card “The coin's vault — one per coin, split frozen at creation” → “90% to lockers — split by size and lock length, paid in ETH”, “10% Clasp treasury”, “0% the creator”. Animated ETH dots along the paths.

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:12.8 | Every Clasp coin has its own vault. | Every Clasp coin has its own vault. |
| 0:15.0 | It takes two percent of every trade on Clasp, plus the coin's creator fees from Pons. | It takes 2% of every trade on Clasp, plus the coin's creator fees from Pons. |
| 0:20.1 | Lockers get ninety percent. Clasp gets ten. The creator gets nothing. | Lockers get 90%. Clasp gets 10%. The creator gets nothing. |

### lock — 0:24.8–0:38.5

On screen: Header “02 Locking”. “4 hours to 1 year.” Lock-length chips 4h…1y with slider; time-boost counter 1.000× → 4.000× (computed from 1 + 3·sqrt((t−4h)/(1y−4h))); size bonus rows: from 0.1% of supply +10%, from 0.5% +25%, from 1% +50%. “Collect anytime.” card: ETH bar builds, Collect button, “Sent to your wallet”, chips “Coins stay locked”, “Collect as often as you like”. “Leaving early costs coins.” burn chart max(5%, 25% × time left ÷ lock length) with playhead 25.0% → 5.0% and a kept/burned bar (burned to 0x…dEaD).

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:25.2 | Lock for four hours, up to a year. | Lock for 4 hours, up to a year. |
| 0:27.4 | Longer locks count up to four times more, and big locks get a size bonus. | Longer locks count up to 4× more, and big locks get a size bonus. |
| 0:31.9 | Collect your ETH anytime. | Collect your ETH anytime. |
| 0:33.8 | Leaving early burns part of your coins, from twenty-five percent down to five. | Leaving early burns part of your coins, from 25% down to 5%. |

### ui — 0:38.5–0:53.1

On screen: Header “03 clasp.fun”. Real clasp.fun captures in a browser frame (badge: “Real site · test coin, not an investment”): home hero → coin page for Clasp Test (Paid to lockers 0.001305 ETH highlighted) → lock panel, cursor clicks 1w then 1y, “1 year = 4× time boost” → trade panel note “Trades here pay a 2% fee to this coin's vault…” → sign-in dialog: wallet section “Clasp never sees your keys”, Google button “Custodial: Clasp holds the key” → launch form “Coin, vault, first buy and lock: one transaction”.

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:39.0 | It all runs on clasp dot fun. | It all runs on clasp.fun. |
| 0:41.1 | Open a coin, pick an amount and a lock length. | Open a coin, pick an amount and a lock length. |
| 0:44.3 | Trade on the same page. | Trade on the same page. |
| 0:46.2 | Sign in with a wallet, or with Google, which is custodial. | Sign in with a wallet, or with Google, which is custodial. |
| 0:50.4 | Or launch a coin with its vault built in. | Or launch a coin with its vault built in. |

### proof — 0:53.1–1:08.8

On screen: Header “04 Proof”. “Mainnet · chain 4663” / “Live on Robinhood Chain.” Cards: Immutable (no proxies, no upgrade key, no admin path to locked coins or earned ETH), Verified (Sourcify; factory 0x8286…60af, router 0x2c2F…f92A), Tested (84 unit, fuzz and invariant tests, plus 3 fork tests against live chain state). Then chip “Our own end-to-end test · 2026-09-25”, “A throwaway test coin, on mainnet.”, counter 0.0000 → 0.0879 ETH “Into the test vault, first hours”, note “Mostly Pons launch-window tax paid by about a dozen bot wallets. 0.001305 ETH reached the two lockers within minutes.” Keeper card: “harvest() — pulled the creator fees into the vault”, “Treasury share — sent the 10% to the treasury”, “$CLTEST was a test coin, not an investment.”

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:53.5 | It's live on Robinhood Chain. The contracts are immutable and verified. | It's live on Robinhood Chain. The contracts are immutable and verified. |
| 0:57.8 | Our test coin's vault took in zero point zero eight seven nine ETH in its first hours, mostly bot launch tax. | Our test coin's vault took in 0.0879 ETH in its first hours, mostly bot launch tax. |
| 1:05.1 | Our keeper bot harvested it and sent the treasury share on its own. | Our keeper bot harvested it and sent the treasury share on its own. |

### honest — 1:08.8–1:13.4

On screen: Header “05 Risks”. Warm warning card: “Plainly — Not audited yet. Memecoins can go to zero.” Chips: “Pons v2 is unaudited too”, “A coin with no trading pays nothing”, “Google sign-in is custodial”.

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 1:09.2 | It's not audited yet, and meme coins can go to zero. | It's not audited yet, and memecoins can go to zero. |

### end — 1:13.4–1:17.6

On screen: End card: Clasp mark + wordmark, “Lock a coin you believe in. / Earn a share of every trade.”, clasp.fun, @ClaspFun, “On Robinhood Chain · fees paid in ETH”.

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 1:13.9 | Clasp dot fun. | clasp.fun |

## clip-money-flow.mp4 — post 03 (20.4 s, 1920×1080, 30 fps)

### flow — 0:00.0–0:17.5

On screen: “Where does the ETH come from?” Vault card appears; “Clasp trading fee 2% of every buy or sell through Clasp” with a scrolling Buy/Sell ticker; “Pons creator fees — pointed at the vault, pulled in by anyone, or Clasp's keeper bot”; “90% to lockers” with a release bar “Released over 1 hour 0/60 → 60/60 min”; “10% Clasp treasury”; “0% the creator”.

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:00.6 | Where does the ETH come from? | Where does the ETH come from? |
| 0:02.4 | Every buy or sell through Clasp pays a two percent fee into the coin's vault. | Every buy or sell through Clasp pays a 2% fee into the coin's vault. |
| 0:07.1 | The coin's creator fees from Pons land there too. | The coin's creator fees from Pons land there too. |
| 0:09.9 | Ninety percent streams to lockers over one hour. | 90% streams to lockers over 1 hour. |
| 0:13.1 | Ten percent goes to Clasp. The creator takes zero. | 10% goes to Clasp. The creator takes 0%. |

### end — 0:17.5–0:20.4

On screen: Compact end card (mark, tagline, clasp.fun, @ClaspFun).

No voice-over (music + end card).

## clip-lock-weight.mp4 — post 07 (24.2 s, 1920×1080, 30 fps)

### weight — 0:00.0–0:21.3

On screen: “Your share depends on weight.” Tokens: Amount × Time boost (1.000× to 4.000×) × Size boost (up to +50%); “Your share of every payout = your weight ÷ total weight”. “Time boost: a square-root curve.” curve drawing with playhead readout and exact table 4 hours 1.000×, 1 day 1.143×, 1 week 1.411×, 30 days 1.858×, 90 days 2.489×, 180 days 3.106×, 1 year 4.000×. “Size boost: one big lock counts extra.” cards 0.1% of supply +10% ×1.10, 0.5% +25% ×1.25, 1% +50% ×1.50; chip “Max combined: 4.000× time × 1.50 size = 6.0×”. “Two lockers, same amount.” bars: 1-year lock (4.000×) 73.9%, 1-week lock (1.411×) 26.1%; footnote “Worked example from the formula: weights 4.000 and 1.411, no size boost. Each payout splits by weight ÷ total weight.”

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:00.6 | Your share of the fees depends on your weight. | Your share of the fees depends on your weight. |
| 0:02.8 | Weight is the amount you lock, times a time boost, times a size boost. | Weight is the amount you lock, times a time boost, times a size boost. |
| 0:07.2 | Time goes from one times at four hours, to four times at a year. | Time goes from 1× at 4 hours, to 4× at a year. |
| 0:11.1 | Locking a big slice of the supply adds up to fifty percent. | Locking a big slice of the supply adds up to +50%. |
| 0:15.3 | Two lockers, same amount: the one-year lock gets about seventy-four percent of each payout. | Two lockers, same amount: the 1-year lock gets about 74% of each payout. |

### end — 0:21.3–0:24.2

On screen: Compact end card.

No voice-over (music + end card).

## clip-early-exit.mp4 — post 11 (20.9 s, 1920×1080, 30 fps)

### exit — 0:00.0–0:18.0

On screen: “Leaving a lock early.” / “Allowed any time. It costs part of the locked coins.” Burn chart “Burn = max(5%, 25% × time left ÷ lock length)”, playhead readout 25.0% → 5.0%, “5% floor” at 80% through. Cards: “Burned coins — sent to 0x…dEaD. Gone for good.”, “Uncollected ETH — goes back to the other lockers.”, “Collected ETH — always yours.” Footnote: “In our mainnet test, unlocking a minutes-old 4-hour lock burned about 24.8%.”

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:00.6 | You can leave a lock early. It costs part of your coins. | You can leave a lock early. It costs part of your coins. |
| 0:03.7 | The burn starts at twenty-five percent and shrinks as the lock runs, but never below five. | The burn starts at 25% and shrinks as the lock runs, but never below 5%. |
| 0:09.4 | Burned coins are gone for good. | Burned coins are gone for good. |
| 0:11.1 | ETH you haven't collected goes back to the other lockers. | ETH you haven't collected goes back to the other lockers. |
| 0:14.6 | ETH you already collected stays yours. | ETH you already collected stays yours. |

### end — 0:18.0–0:20.9

On screen: Compact end card.

No voice-over (music + end card).

## clip-walkthrough.mp4 — post 15 (24.6 s, 1920×1080, 30 fps)

### walk — 0:00.0–0:21.7

On screen: Real clasp.fun captures in a browser frame (badge “Real site · test coin, not an investment”): home → Clasp Test coin page (price, lockers, paid-to-lockers cells highlighted) → lock panel zoom: amount typed 1000000, click 1w, click 1y, label “1 year · full 4× time boost” → trade panel: note highlighted, then fee rows “2% Clasp fee → this coin's vault” → sign-in dialog: “Clasp never sees your keys” (own wallet), “Custodial: Clasp holds the key” (Google).

| Time | Voice-over (spoken) | Caption |
|---|---|---|
| 0:00.6 | Here's a lock on clasp dot fun, start to finish. | Here's a lock on clasp.fun, start to finish. |
| 0:03.9 | Open a coin to see its price, its lockers, and what it has paid out. | Open a coin to see its price, its lockers, and what it has paid out. |
| 0:08.0 | Enter an amount and pick a lock length. | Enter an amount and pick a lock length. |
| 0:10.2 | One year gets the full four times boost. | One year gets the full 4× boost. |
| 0:13.2 | Trades on this page pay two percent into the coin's vault. | Trades on this page pay 2% into the coin's vault. |
| 0:17.2 | Then sign in with your own wallet, or with Google, which is custodial. | Then sign in with your own wallet, or with Google, which is custodial. |

### end — 0:21.7–0:24.6

On screen: Compact end card.

No voice-over (music + end card).
