# Clasp: memecoin fees that pay the people who hold

[cover.png]

Every trade on a memecoin pays a fee. On almost every coin, that fee goes to one wallet. Clasp sends it to the people who lock the coin instead — paid in ETH, weighted by how long and how much they commit.

Clasp is live on Robinhood Chain mainnet today at clasp.fun. This is a full walk-through: what it is, why we built it, exactly how the money moves, what we did to make it safe to use, what we have not done yet, and what happened when we ran it end to end with real money.

## The short version

- Every Clasp coin has its own vault contract.
- ETH flows into the vault from two sources: the coin's creator fees on Pons, and a 2% fee on trades made through Clasp.
- 90% of everything that arrives goes to the people who lock the coin. 10% goes to the Clasp treasury. The coin's creator gets 0%.
- Lock for anywhere from 4 hours to 1 year. Longer locks earn up to 4× more per coin; very large locks earn up to 50% more on top.
- Collect your ETH whenever you like. Leave early if you must — it costs a slice of your locked coins, never your collected ETH.
- The contracts cannot be upgraded, and no one — including us — can move locked coins or earned ETH.

## The problem we started from

Memecoins generate a surprising amount of trading volume, and every trade pays a fee. On a launchpad like Pons, a coin's creator sets a creator tax and names a single address to receive it. That address collects on every buy and every sell for as long as the coin trades.

The people producing that volume — the holders who buy early, stay, and bring others in — get nothing from it. Their only way to profit is to sell to someone else, which is also the fastest way to kill the coin they believe in.

We think that is backwards. The people who commit to a coin should be the ones who get paid by its activity. Clasp is a small, sharp tool that does exactly that and nothing else.

## What Clasp does

Clasp gives every coin a vault. The vault becomes the coin's creator fee recipient on Pons, and it also receives Clasp's own 2% trading fee. Holders lock their coins in the vault, and the vault pays them — in ETH — a share of everything that comes in.

Two things decide your share: how long you lock and how many coins you lock. That is the whole model. There are no points, no emissions, no new token to farm, and no rewards paid in the memecoin itself. The only thing a vault ever pays out is the ETH that real trading put into it.

[fig-money-flow.png]

## How the money moves

A vault takes in ETH from two places.

**Pons creator fees.** When a coin joins Clasp, its Pons creator fee recipient is set to its vault. Pons collects the creator tax on every trade and holds it in its fee escrow. Anyone can call `harvest()` on the vault to pull those fees in; Clasp runs a small bot that does it automatically once enough has built up.

**Clasp's 2% trading fee.** Trades placed on clasp.fun go through the Clasp router, which takes 2% of the ETH side of each buy or sell and sends it straight to that coin's vault in the same transaction. If the trade fails, there is no fee.

Everything that arrives is split the same way, forever: **90% to lockers, 10% to the Clasp treasury.** The split is written into each vault when it is created and can never change for that vault.

The vault counts incoming ETH by watching its own balance, and every ETH it sends out is recorded. If its balance ever dropped by an amount it did not record, it refuses to continue. Our tests check, after every single action, that a vault never owes more ETH than it holds.

## Locking: time and size

When you lock, you choose how many coins and for how long — anywhere from 4 hours to 365 days. Your lock gets a weight, and your share of every arrival is your weight divided by everyone's weight.

**Time.** The duration multiplier follows a square-root curve from 1.0× at 4 hours to 4.0× at one year. The curve rises fastest at the start, so even a modest commitment is worth making, and it keeps rewarding longer locks without letting them run away.

[fig-multiplier-curve.png]

| Lock length | Multiplier |
|---|---|
| 4 hours | 1.000× |
| 1 day | 1.143× |
| 1 week | 1.411× |
| 30 days | 1.858× |
| 90 days | 2.489× |
| 180 days | 3.106× |
| 1 year | 4.000× |

**Size.** A single lock that holds a meaningful share of the coin's total supply gets a bonus on top: +10% at 0.1% of supply, +25% at 0.5%, +50% at 1%. The most a lock can reach is 6.0× — one year and at least 1% of supply.

**Weight = coins × duration multiplier × size bonus.**

[fig-worked-example.png]

ETH builds up continuously, and you can collect it at any time without touching your lock. You can extend a lock whenever you like, and add more coins to it while at least 4 hours remain. When a lock ends, your coins come back to you along with anything you have not collected yet. You do not even have to be there: anyone can press unlock on a finished lock — our bot does it automatically, largest first — but the coins and ETH only ever go to the owner.

## Why rewards drip out over an hour

If fees were paid out the instant they arrived, a bot could watch for a large trade, lock a pile of coins one block later, collect a share of that fee, and leave. Everyone who had been locked all along would be diluted by someone who was there for one block.

So every vault releases what it receives in a straight line over one hour. New weight only shares in what is released after it joined. And because the shortest lock is 4 hours, anyone who wants a piece of that hour has to commit for at least four.

## Leaving early

You can end a lock early. It costs you part of the coins you locked, and those coins are burned — sent to an address no one controls, gone for good.

The cost starts at 25% and shrinks as your lock runs down, to a floor of 5%. Halfway through a lock it is 12.5%. With a fifth of the time left, it is at the 5% floor.

[fig-early-exit.png]

Two things are never at risk when you leave early: ETH you have already collected is yours, and the coins you get back are yours. The only other thing you give up is ETH you have earned but not collected yet, which goes back into the pool for the people who stayed — released over the same hour as everything else.

The burn is there for one reason: without it, locking for a year to get 4× and then leaving on day two would be free. With it, the multiplier means something.

## Two ways to put a coin on Clasp

**Launch a new coin with its vault built in.** The launch form on clasp.fun does everything in a single transaction: it creates the coin on Pons, creates its Clasp vault, points the creator fees at the vault before anyone can trade, makes the creator's first buy, and — if the creator wants — locks part of that buy for them. The creator's own lock earns like anyone else's.

**Add a coin that already exists on Pons.** Anyone can create a vault for any eligible Pons coin; it only costs gas. Then whoever currently receives the coin's creator fees points them at the vault. From that moment, the fees that used to go to one wallet go to the people who lock.

Clasp supports Pons v2 coins traded against ETH with buybacks switched off. That is all the vault can pay out correctly, so it refuses anything else.

[shot-launch.png]

## Signing in

You can use Clasp two ways, and we want to be precise about the difference.

**With your own wallet** — MetaMask, Rabby, Coinbase Wallet or any browser wallet. Clasp detects what you have installed. Your wallet signs everything; Clasp never sees your keys and only learns your public address.

**With Google.** For people who do not have a wallet yet, Clasp can create one for your Google account. This is custodial: **Clasp keeps that wallet's key** on its servers, encrypted, and signs transactions for you when you ask. You can withdraw ETH or export the private key whenever you want and move to your own wallet. If you would rather no one but you ever held your key, use your own wallet.

[shot-signin.png]

## What we built to make it safe to use

**The contracts cannot be changed.** There are no proxies and no upgrade key. The code you lock with is the code that pays you out.

**There is no admin path to your coins or your ETH.** Clasp's factory has an owner, and that owner can do exactly three things, all about the future: change the default rules for vaults created later, change where the 10% goes for vaults created later, and pause the creation of new vaults. None of that reaches into a vault that already exists. Each vault writes its rules into itself when it is created and keeps them forever.

[fig-safety.png]

**It is tested like it holds money.** 84 unit, fuzz and invariant tests, plus a fork suite that runs full launches, trades, locks, harvests and exits against a copy of live Robinhood Chain state. The invariant suite runs 256 randomized sequences of 120 actions across seven actors — including one that randomly refuses to accept ETH — and checks after every step that the vault can pay everything it owes.

**One stuck wallet cannot block anyone.** If a payout to a wallet fails, the ETH is credited to that wallet to withdraw later, and everyone else keeps getting paid.

**The source is public and verified.** All three contracts are verified on Sourcify; the addresses are at the end of this article.

**The chores run themselves.** A small keeper bot pulls in creator fees, releases finished locks and sends the treasury its share. Every one of those actions is something anyone can do; the bot's key only holds gas money and can only spend its own.

[fig-architecture.png]

## Proof: our first live run

Before writing a word of this, we ran Clasp end to end on mainnet with real ETH, from two fresh wallets that have nothing to do with our own. We launched a throwaway coin called Clasp Test ($CLTEST) and went through every action a real user would take.

[fig-live-test.png]

- **Launch.** One transaction created the coin, its vault, pointed the creator fees at the vault and locked half of the creator's first buy for 4 hours.
- **Buy and lock.** A second wallet bought through the Clasp router — 2% of the ETH went to the vault in the same transaction — and locked half of what it bought.
- **Sell and harvest.** It sold a quarter back through the router and called `harvest()` to pull in the coin's creator fees.
- **Collect.** After only minutes, both lockers collected their ETH.
- **Leave early.** Both ended their 4-hour locks after minutes. Each burned about 24.8% of their locked coins — exactly the rule for a lock that has barely started.

Two things happened that we did not do. First, within minutes of launch, about a dozen outside wallets — launch bots that trade every new Pons coin — bought and sold $CLTEST. The launch-window tax they paid on Pons went straight into the vault: 0.0879 ETH in its first hours. Second, Clasp's keeper noticed those fees and harvested them, then sent the treasury its share, on its own.

To be clear about what this shows and what it does not: $CLTEST was a test and is not an investment. Most of its fees came from launch bots in the first minutes, which is not what a normal week looks like. What it does show is that every piece of Clasp works on mainnet, with real money, including the parts that run without us.

Every step is on the explorer:
- Launch: https://robinhoodchain.blockscout.com/tx/0xfced6b0117b397a213404227345993042932c0d40dbfbda8e523b7ef1f35770b
- Buy through the router: https://robinhoodchain.blockscout.com/tx/0xee536204b1c5274a35f1f80568488c7afc18209a2a375fd88185e94bfa78eca1
- Lock: https://robinhoodchain.blockscout.com/tx/0xcd52240733e081695e8ad00d0f942143aaff76e64606e7214f17ccfb2a2936ca
- Harvest: https://robinhoodchain.blockscout.com/tx/0xdf4ad4af0fcdaeea490acdaadf0cdfe706483ad5bdb183a11812736eedaa4c0c
- Keeper harvest, on its own: https://robinhoodchain.blockscout.com/tx/0x2a42439e924578848a2e08e10444524998bdd708559315f523efaa25fb2130c3
- Collect: https://robinhoodchain.blockscout.com/tx/0x83e58bfe95a654e4d7ac8d99b439a9aa3a01b573f2d3152dd97e47c6c035cb8e
- Early exit: https://robinhoodchain.blockscout.com/tx/0x949b958c5c53b9bf5b789363c32693a2faedb894460d5b6b3d946988e9458c14

It is also cheap. On Robinhood Chain, a buy cost about 0.0000094 ETH in gas, a lock about 0.0000101 ETH, and a launch — coin, vault and first buy together — about 0.000245 ETH.

## The risks, plainly

- **Not audited yet.** Clasp's contracts are heavily tested but have not been audited by an outside firm. Pons describes its own v2 contracts as unaudited too. A bug in either could lose funds. Only lock what you can afford to lose.
- **Memecoins can go to zero.** Locking does nothing to protect the price of the coin.
- **No trading, no fees.** A coin that nobody trades pays its lockers nothing.
- **Pons's admin can redirect creator fees.** Pons's owner — a 2-of-3 multisig — can change any coin's creator fee recipient after a public 3-day wait. It is part of Pons and Clasp cannot switch it off. If it ever happened to a Clasp coin, only the Pons creator fees would stop reaching its vault; Clasp's 2% fee, the locked coins and ETH already earned would be unaffected. Clasp watches for these proposals and shows a warning on the coin's page with the date it could take effect.
- **Google sign-in is custodial.** If you sign in with Google, you are trusting Clasp with that wallet's key.

## Contract addresses

All on Robinhood Chain (chain ID 4663), verified on Sourcify.

- ClaspFactory — `0x82866AEAD0a590E5f9e7da74fC8c4FCAFFad60af`
- ClaspRouter — `0x2c2F23acbEd17827b7873Ce1Bc7430ADEB7Bf92A`
- ClaspLauncher — `0xE9E68B421dD2dE4F6825A9D5288D00732432A7af`

[fig-addresses.png]

## Start here

- Browse coins and lock: clasp.fun/coins
- Launch a coin with its vault built in, or add your Pons coin: clasp.fun/launch
- How it works, in plain words: clasp.fun/how-it-works
- Everything about safety and risk: clasp.fun/security

Lock a coin you believe in. Earn a share of every trade.
