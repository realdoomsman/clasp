import { DEFAULT_TERMS, durationBps } from '@clasp/sdk';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MoneyFlow } from '@/components/home/MoneyFlow';
import { PageHeader } from '@/components/ui';
import { DURATION_PRESETS } from '@/lib/durations';
import { formatMultiplier } from '@/lib/format';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'How locking works on Clasp, where the ETH comes from, and how your share is worked out — in plain words.',
};

const BOOSTS = DURATION_PRESETS.map((p) => [
  p.long,
  formatMultiplier(durationBps(BigInt(p.secs), BigInt(DEFAULT_TERMS.minLockSecs), BigInt(DEFAULT_TERMS.maxLockSecs))),
]);

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="How it works" title="Lock, earn, collect">
        Clasp pays the people who hold a coin for the long run. Here is the whole thing, without the jargon.
      </PageHeader>

      <div className="prose-clasp">
        <h2>The short version</h2>
        <p>
          Every coin on Clasp has its own <strong>vault</strong>: a program on Robinhood Chain that holds locked coins and
          the ETH they earn. When people trade the coin, part of the fee lands in the vault. The vault shares it out, in
          ETH, among everyone who has locked the coin. The more you lock and the longer you lock it, the bigger your
          share.
        </p>
      </div>

      <div className="my-10">
        <MoneyFlow />
      </div>

      <div className="prose-clasp">
        <h2>Where the ETH comes from</h2>
        <ul>
          <li>
            <strong>2% of every trade made through Clasp.</strong> Buy or sell a coin on its Clasp page and 2% of the ETH
            side of the trade goes straight to that coin’s vault, in the same transaction. If the trade fails, there’s no
            fee.
          </li>
          <li>
            <strong>The coin’s Pons creator fees.</strong> Coins on Clasp are launched on the Pons launchpad. Pons pays
            each coin’s creator a fee on trades, and on Clasp coins that fee is pointed at the vault instead of a
            person. Anyone can press the button that pulls these fees into the vault, and Clasp’s helper bot does it
            regularly.
          </li>
        </ul>
        <p>
          Of everything that arrives, <strong>90% goes to lockers</strong> and <strong>10% to Clasp</strong>. The coin’s
          creator gets nothing extra — if they want a share, they lock like everyone else. If nobody has locked the coin
          yet, the lockers’ part goes to Clasp, because there is no one to pay.
        </p>

        <h2>How your share is worked out</h2>
        <p>
          Each lock gets a score: <strong>coins locked × time boost × size boost</strong>. The ETH is split between
          everyone in proportion to their score.
        </p>
        <h3>Time boost: 1× to 4×</h3>
        <p>
          The shortest lock is 4 hours and counts 1×. The longest is a year and counts 4×. In between, the boost rises
          quickly at first and then more slowly (it follows a square-root curve), so even a few weeks gets you a good
          part of the way:
        </p>
      </div>

      <div className="card my-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Time boost by lock length</caption>
          <thead className="bg-paper-2 text-ink-2">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Lock for
              </th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">
                Time boost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {BOOSTS.map(([d, b]) => (
              <tr key={d}>
                <td className="px-5 py-2.5">{d}</td>
                <td className="num px-5 py-2.5 text-right font-semibold">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose-clasp">
        <h3>Size boost: up to +50%</h3>
        <p>
          A single big lock gets a little extra on top: <strong>+10%</strong> if it is at least 0.1% of all the coin’s
          supply, <strong>+25%</strong> at 0.5%, and <strong>+50%</strong> at 1% or more. A year-long lock of 1% of the
          supply therefore counts 4 × 1.5 = <strong>6×</strong>.
        </p>

        <h3>Fair timing</h3>
        <p>
          New ETH isn’t handed out the instant it arrives. It is released to lockers smoothly over about an hour. That
          way nobody can jump in right after a big trade, grab a slice, and leave.
        </p>

        <h2>Collecting and unlocking</h2>
        <ul>
          <li>
            <strong>Collect anytime.</strong> Your ETH builds up continuously. Collect it whenever you like, from{' '}
            <Link href="/earn">My locks</Link>.
          </li>
          <li>
            <strong>When your lock ends</strong>, you can unlock any time: your coins and any uncollected ETH go back to your
            wallet. Clasp’s keeper also unlocks ended locks automatically, largest first. Anyone may trigger it, but the
            coins and ETH can only ever go to you.
          </li>
          <li>
            <strong>Add more or lock for longer.</strong> You can add coins to a lock while at least 4 hours are left on it
            (the new coins count for the time that’s left), or push the end date further out for a bigger boost.
          </li>
          <li>
            <strong>Unlocking early costs coins.</strong> Leave before the end date and part of your locked coins is burned
            (sent to an address nobody controls, so they are gone for good). It starts at 25% and shrinks the closer you
            are to the end, but is never less than 5%. You also give up the ETH you haven’t collected yet — it goes back to
            the other lockers, released over the same hour. ETH you already collected is always yours. The site always
            shows you the exact numbers first.
          </li>
          <li>
            <strong>The smallest lock</strong> is one whole coin.
          </li>
        </ul>

        <h2>Rules that can’t change</h2>
        <p>
          The numbers on this page are Clasp’s defaults. When a coin’s vault is created, the rules in force are written
          into it permanently. Nobody — not Clasp, not the coin’s creator — can change a vault’s rules afterwards. Each
          coin’s page lists the exact rules of its vault.
        </p>

        <h2>Launching</h2>
        <p>
          Every Clasp coin is <Link href="/launch">launched on Clasp</Link>, with its vault built in, in one transaction:
          the coin is created on Pons with its creator fees pointed at the vault before anyone can trade, the creator’s
          first buy is made, and part of it can be locked straight away. Coins launched elsewhere can’t be added.
        </p>

        <h2>The yearly rate</h2>
        <p>
          Coin pages show a <strong>yearly rate</strong> (sometimes called APR). It takes the ETH paid to lockers over
          the last 7 days, scales it up to a year, and compares it with the value of the coins locked. It describes the
          past week, not the future: it changes whenever trading or the coin’s price changes.
        </p>

        <p className="mt-8">
          Ready? <Link href="/coins">Browse coins</Link> or read about <Link href="/security">security and risks</Link>.
        </p>
      </div>
    </div>
  );
}
