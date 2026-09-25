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
        <h2>Signing in</h2>
        <p>
          With your own wallet, such as MetaMask, Rabby or Coinbase Wallet, the site only learns its public address and
          your keys never leave your wallet.
        </p>
        <p>
          With <strong>Continue with Google</strong>, Google tells us your Google account ID and email address. We store
          them with the wallet we create for you, whose private key we keep encrypted on our servers (see{' '}
          <a href="/security#google">Security</a>). We use your email only to identify your account. We keep a log of the
          transactions we sign for you and of key exports, to protect your account.
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
          With your own wallet, the site stores small pieces of data in your browser so your wallet reconnects. With Google,
          our API also sets one sign-in cookie that keeps you signed in for up to 30 days. Nothing is used for tracking.
        </p>
      </div>
    </div>
  );
}
