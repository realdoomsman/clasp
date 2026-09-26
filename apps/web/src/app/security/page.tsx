import { addresses, officialCoin } from '@clasp/sdk';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { claspContracts, explorerAddress } from '@/lib/chain';

export const metadata: Metadata = {
  title: 'Security & risks',
  description: 'How Clasp keeps locked coins and earnings safe, what it cannot protect against, and every contract address.',
};

const CONTRACTS: { name: string; what: string; address: string }[] = [
  { name: 'Clasp factory', what: 'Creates one vault per coin', address: claspContracts.factory },
  { name: 'Clasp router', what: 'Buys and sells, sending the 2% fee to the coin’s vault', address: claspContracts.router },
  { name: 'Clasp launcher', what: 'Launches a coin on Pons with its vault in one transaction', address: claspContracts.launcher },
  { name: 'Official $CLASP coin', what: 'The one official Clasp coin. Any other “Clasp” coin is a copy.', address: officialCoin.token },
  { name: '$CLASP vault', what: 'Holds locked CLASP and pays its lockers', address: officialCoin.vault },
  { name: 'Pons launch factory', what: 'The Pons launchpad (owned by a 2-of-3 Safe)', address: addresses.ponsFactory },
  { name: 'Pons fee escrow', what: 'Holds creator fees until the vault pulls them in', address: addresses.ponsFeeEscrow },
  { name: 'Pons pool hook', what: 'Trading after a coin moves to Uniswap', address: addresses.ponsMemeHook },
  { name: 'Pons owner Safe', what: 'Can redirect creator fees after a 3-day wait', address: addresses.ponsOwner },
  { name: 'Uniswap v4 pool manager', what: 'Where graduated coins trade', address: addresses.uniswapV4PoolManager },
];

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Security" title="Security & risks">
        What protects your coins and earnings, what doesn’t, and where to check everything yourself.
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['Can’t be changed', 'No upgrade key, no proxies. The code you lock with is the code that pays you out.'],
          ['No admin access to funds', 'No admin — including Clasp — can move locked coins or earned ETH out of a vault.'],
          ['Google sign-in is custodial', 'If you sign in with Google, Clasp holds your wallet’s key. Your own wallet avoids that.'],
          ['One outside risk', 'Pons’s admin can redirect a coin’s creator fees after a 3-day public wait.'],
          ['Not audited yet', 'No outside audit so far. Pons also calls its v2 contracts unaudited.'],
        ].map(([title, body]) => (
          <div key={title} className="card p-5">
            <p className="font-display text-lg font-semibold">{title}</p>
            <p className="mt-1 text-sm text-ink-2">{body}</p>
          </div>
        ))}
      </div>

      <div className="prose-clasp mt-4">
        <h2>The contracts can’t be changed</h2>
        <p>
          Clasp’s contracts are deployed once and can never be upgraded. There are no proxies and no “admin can replace
          the code” switch. Each coin’s vault writes its rules (lock lengths, boosts, early-unlock cost, fee split) into
          itself when it is created, and they stay that way forever.
        </p>
        <p>
          The Clasp factory has an owner, and that owner can do exactly three things, all about the future: change the
          default rules for <strong>vaults created later</strong>, change where Clasp’s 10% goes for{' '}
          <strong>vaults created later</strong>, and pause the creation of <strong>new</strong> vaults. None of these
          reach into a vault that already exists.
        </p>

        <h2>Nobody can take locked coins or earnings</h2>
        <ul>
          <li>Locked coins can only go back to the wallet that locked them, or be burned by that wallet’s own early unlock.</li>
          <li>Earned ETH can only be paid to the lock’s owner. Clasp’s 10% can only be paid to Clasp’s treasury address.</li>
          <li>
            Anyone may press “unlock” on a lock that has ended (Clasp’s keeper does this automatically, largest first), but
            the coins and ETH still go only to the owner.
          </li>
          <li>
            If a payment to your wallet fails (for example a smart-contract wallet that refuses ETH), the ETH is kept for
            you and you can withdraw it later from <a href="/earn">My locks</a>. One failing wallet can never block anyone
            else.
          </li>
        </ul>

        <h2 id="pons-admin" className="scroll-mt-24">
          The Pons admin can redirect creator fees
        </h2>
        <p>
          Clasp coins are launched on the Pons launchpad. Pons lets each coin name a <strong>creator fee recipient</strong>
          , and on Clasp that is the coin’s vault. But Pons’s own admin — a 2-of-3 multisig wallet — keeps the power to
          change any coin’s fee recipient. It works like this:
        </p>
        <ul>
          <li>The admin publicly proposes a new recipient. This is visible on-chain immediately.</li>
          <li>After a <strong>3-day wait</strong>, anyone can carry out the change, within 3 more days.</li>
          <li>Clasp can’t switch this off. It is part of Pons, not Clasp.</li>
        </ul>
        <p>
          <strong>What it would affect:</strong> only that coin’s Pons creator fees, which would stop reaching its
          lockers. <strong>What it can’t affect:</strong> Clasp’s 2% trading fee, the coins locked in the vault, and ETH
          already earned.
        </p>
        <p>
          Clasp watches for these proposals. If one is pending for a coin, its page shows a red warning with the date it
          could take effect, so you have days to decide what to do.
        </p>

        <h2 id="google" className="scroll-mt-24">
          Signing in with Google means Clasp holds your key
        </h2>
        <p>
          “Continue with Google” creates a wallet for your Google account, and <strong>Clasp keeps that wallet’s private
          key</strong> on its servers, encrypted, and signs transactions for you when you ask. That makes it easy to start,
          but it means you are trusting Clasp with that wallet:
        </p>
        <ul>
          <li>Anyone who takes over your Google account can use the wallet. Protect your Google account with 2-step verification.</li>
          <li>If Clasp’s servers were broken into, the keys of Google wallets could be stolen along with what they hold.</li>
          <li>If Clasp’s service is down, you can’t use a Google wallet from this site until it is back.</li>
        </ul>
        <p>
          You can move out any time: <strong>Withdraw ETH</strong> sends ETH to any address, and{' '}
          <strong>Export private key</strong> gives you the key to import into a wallet app such as MetaMask or Rabby. If
          you connect your own wallet instead, Clasp never sees your key.
        </p>

        <h2>No audit yet</h2>
        <p>
          Clasp’s contracts are tested heavily, including against a copy of the live chain, but they have{' '}
          <strong>not been audited by an outside firm yet</strong>. Pons describes its own v2 contracts as unaudited too.
          A bug in either could lose funds. Please only lock what you can afford to lose.
        </p>

        <h2>Other things to keep in mind</h2>
        <ul>
          <li>Memecoins are extremely risky and can go to zero. Locking protects nothing about the price.</li>
          <li>A coin with no trading earns its lockers nothing.</li>
          <li>
            With your own wallet, this website only prepares transactions and your wallet signs them. Always check what your
            wallet shows before confirming. Your locks stay reachable through any other blockchain tool even if this site is
            down.
          </li>
        </ul>
      </div>

      <h2 className="mt-12 text-2xl font-semibold">Contract addresses</h2>
      <p className="mt-2 text-ink-2">All on Robinhood Chain. Check the code yourself on the explorer.</p>
      <ul className="card mt-4 divide-y divide-line">
        {CONTRACTS.map((c) => (
          <li key={c.name} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-ink-3">{c.what}</p>
            </div>
            <a
              href={explorerAddress(c.address)}
              target="_blank"
              rel="noreferrer"
              className="num text-sm break-all text-accent-strong underline underline-offset-2 sm:text-right"
            >
              {c.address}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
