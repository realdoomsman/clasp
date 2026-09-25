import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Terms of use' };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Legal" title="Terms of use">
        Plain-language terms for using this website. Please read them before you lock, buy, sell or launch anything.
      </PageHeader>
      <div className="prose-clasp">
        <h2>What Clasp is</h2>
        <p>
          Clasp is a website that helps you use a set of smart contracts on Robinhood Chain. The contracts let holders of
          a coin lock it and share that coin’s trading fees, paid in ETH. The website is only a window onto those
          contracts: every action is a transaction that you review and sign in your own wallet.
        </p>

        <h2>You are in control, and responsible</h2>
        <ul>
          <li>
            Clasp never holds your keys and cannot move your coins or ETH. Transactions you sign cannot be reversed by
            anyone, including us.
          </li>
          <li>You are responsible for checking every transaction before you sign it and for keeping your wallet safe.</li>
          <li>You must be allowed to use services like this where you live. Don’t use Clasp if you are not.</li>
        </ul>

        <h2>Risks you accept</h2>
        <ul>
          <li>
            <strong>Coins can lose all their value.</strong> Memecoins are extremely risky. Locking a coin does not protect
            its price.
          </li>
          <li>
            <strong>Earnings are not guaranteed.</strong> Lockers only earn when people trade the coin. A coin with no
            trading pays nothing. Rates shown on the site describe the past, not the future.
          </li>
          <li>
            <strong>Unlocking early costs coins.</strong> If you unlock before your lock ends, part of your locked coins is
            burned (destroyed for good) and the ETH you haven’t collected yet goes back to the other lockers. ETH you
            already collected stays yours.
          </li>
          <li>
            <strong>Software can fail.</strong> The Clasp contracts have not had an external audit yet, and Pons describes
            its own v2 contracts as unaudited. Bugs could cause loss of funds.
          </li>
          <li>
            <strong>Pons can redirect creator fees.</strong> The Pons launchpad’s admin can send a coin’s creator fees
            somewhere else after a 3-day public waiting period. See <Link href="/security">Security</Link>.
          </li>
        </ul>

        <h2>Fees</h2>
        <p>
          Buying or selling through Clasp costs 2% of the ETH side of the trade. Of everything a coin’s vault receives,
          90% goes to that coin’s lockers and 10% to the Clasp treasury. Every transaction also pays a small network
          fee to Robinhood Chain.
        </p>

        <h2>No advice</h2>
        <p>
          Nothing on this site is financial, investment, legal or tax advice. Numbers such as yearly rates, examples and
          projections are estimates for illustration only.
        </p>

        <h2>The website itself</h2>
        <p>
          The site is provided “as is”, without warranties. It may be unavailable, slow, or show out-of-date numbers.
          Your coins and earnings live in the contracts, not on this website, and remain reachable through any other
          tool that can talk to the blockchain. To the extent the law allows, we are not liable for losses from using
          the site or the contracts.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. The contracts themselves cannot be changed: each coin’s vault keeps the rules it was
          created with.
        </p>
      </div>
    </div>
  );
}
