import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Legal" title="Privacy">
        We collect as little as we can. Here is exactly what happens with your data.
      </PageHeader>
      <div className="prose-clasp">
        <h2>Connecting a wallet</h2>
        <p>
          Clasp has no accounts and no log-in service. You connect a wallet you already use, such as MetaMask, Rabby or
          Coinbase Wallet, and the site only learns its public address. Your keys never leave your wallet.
        </p>

        <h2>The blockchain is public</h2>
        <p>
          Everything you do with Clasp (locking, claiming, trading, launching) is a transaction on Robinhood Chain. Those
          transactions, the amounts and your wallet address are public and permanent, and anyone can read them. Our
          leaderboard and coin pages show this public data.
        </p>

        <h2>What our servers see</h2>
        <ul>
          <li>
            Our data service answers requests for public coin and wallet information. Like any web server it receives
            your IP address and browser type with each request; we use these only to keep the service running and to
            stop abuse.
          </li>
          <li>
            Images you upload when launching a coin are stored and published, because they become the coin’s public
            logo. Don’t upload anything private.
          </li>
          <li>We don’t run advertising or third-party analytics, and we don’t sell data.</li>
        </ul>

        <h2>Cookies and storage</h2>
        <p>
          The site stores small pieces of data in your browser so you stay logged in and your wallet reconnects. Nothing
          is used for tracking.
        </p>
      </div>
    </div>
  );
}
