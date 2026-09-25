import Link from 'next/link';
import type { ReactNode } from 'react';

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'What is Clasp, in one sentence?',
    a: 'You lock a coin you like, and every time someone trades that coin you get a slice of the fee, paid in ETH.',
  },
  {
    q: 'Where does the ETH actually come from?',
    a: (
      <>
        Two places: 2% of the ETH in every buy or sell made through Clasp, and the coin’s creator fees from the Pons
        launchpad, which are pointed at the coin’s vault. 90% of it goes to lockers, 10% to Clasp. No new coins are
        printed to pay you.
      </>
    ),
  },
  {
    q: 'How is my share worked out?',
    a: (
      <>
        Your share grows with how many coins you lock and how long you lock them. Locking for 4 hours counts 1×;
        locking for a full year counts 4×. Big locks get a small extra boost: +10% if your lock is at least 0.1% of the
        coin’s supply, +25% at 0.5%, +50% at 1%. The fees are split between everyone in proportion to those numbers.
      </>
    ),
  },
  {
    q: 'When can I collect my ETH?',
    a: 'Whenever you like, as often as you like. New fees are released to lockers smoothly over about an hour after they arrive, so the split stays fair for everyone.',
  },
  {
    q: 'Can I get my coins back before the lock ends?',
    a: (
      <>
        Yes, but it costs you. Unlocking early burns (permanently destroys) part of your locked coins — up to 25% if you
        leave right away, shrinking as the end date gets closer, but never less than 5%. You also give up the ETH you
        haven’t collected yet; it goes back to the other lockers. ETH you already collected is always yours. The site
        always shows the exact cost before you confirm.
      </>
    ),
  },
  {
    q: 'What happens when my lock ends?',
    a: 'Unlock any time: your coins and any ETH you haven’t collected go back to your wallet. Clasp’s keeper also unlocks ended locks automatically, largest first — it can only ever send them to you.',
  },
  {
    q: 'Can Clasp take my coins or my ETH?',
    a: (
      <>
        No. The contracts can’t be changed and have no admin key that can touch locked coins or earnings. There is one
        outside risk to know about: the Pons launchpad’s admin can redirect a coin’s creator fees after a 3-day public
        wait. <Link href="/security">Read the details</Link>.
      </>
    ),
  },
  {
    q: 'What do I need to get started?',
    a: 'Log in with email, Google or a wallet like MetaMask, Rabby or Coinbase Wallet. You need a little ETH on Robinhood Chain to pay network fees, and the coin you want to lock (you can buy it on the coin’s page).',
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-card">
      {FAQ.map((item) => (
        <details key={item.q} className="group px-5 py-1 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 font-semibold [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2 transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="pb-5 text-ink-2 [&_a]:text-accent-strong [&_a]:underline">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
