import Link from 'next/link';
import type { ReactNode } from 'react';
import { Calculator } from '@/components/home/Calculator';
import { Faq } from '@/components/home/Faq';
import { HomeStats } from '@/components/home/HomeStats';
import { MoneyFlow } from '@/components/home/MoneyFlow';
import { OfficialCoin } from '@/components/home/OfficialCoin';
import { LogoMark } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';

function Section({ id, eyebrow, title, intro, children }: { id?: string; eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? eyebrow}-title`} className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 sm:pt-28">
      <p className="text-sm font-semibold tracking-wide text-accent-strong uppercase">{eyebrow}</p>
      <h2 id={`${id ?? eyebrow}-title`} className="mt-2 max-w-3xl text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-3 max-w-2xl text-lg text-ink-2">{intro}</p>}
      <div className="mt-8 sm:mt-10">{children}</div>
    </section>
  );
}

const STEPS = [
  {
    n: 1,
    title: 'Pick a coin',
    body: 'Browse coins with a Clasp vault, or buy one right on its page. You see what its lockers earned last week before you commit.',
  },
  {
    n: 2,
    title: 'Lock it for 4 hours to a year',
    body: 'Choose how long. Longer locks earn a bigger share — up to 4× for a full year. Your coins stay yours and come back when the time is up.',
  },
  {
    n: 3,
    title: 'Collect ETH anytime',
    body: 'Every trade on the coin adds ETH to the pot. Your part builds up by the minute and you can collect it whenever you like.',
  },
];

const RISKS = [
  ['The coin can lose its value.', 'Locking doesn’t protect the price. Memecoins can go to zero, and you get back coins, not ETH.'],
  ['No trading, no earnings.', 'Lockers are paid from trading fees. A quiet coin pays little or nothing.'],
  ['Leaving early costs coins.', 'Unlocking before your end date burns part of your locked coins (25% at most, 5% at least) and gives up the ETH you haven’t collected yet. ETH you already collected is always yours.'],
  ['Pons can redirect creator fees.', 'The Pons launchpad’s admin can send a coin’s creator fees elsewhere after a 3-day public wait. Clasp’s 2% trading fee and your locked coins are not affected.'],
  ['No audit yet.', 'Clasp’s contracts have not been audited by an outside firm yet, and Pons describes its own v2 contracts as unaudited. Only lock what you can afford to lose.'],
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-accent-soft/80 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-10 sm:px-6 sm:pt-24 lg:grid-cols-[1.35fr_1fr]">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold text-ink-2">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              On Robinhood Chain · paid in ETH
            </p>
            <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl lg:text-[4.25rem]">
              Lock a coin you believe in. <span className="text-accent">Earn a share of every trade.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2 sm:text-xl">
              Every trade on a Clasp coin pays a fee in ETH. The people who lock the coin split it — the longer you lock,
              the bigger your share.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/coins" size="lg">
                Browse coins
              </ButtonLink>
              <ButtonLink href="/launch" size="lg" variant="secondary">
                Launch a coin
              </ButtonLink>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>

      <Section id="official" eyebrow="The official coin" title="$CLASP, launched on Clasp">
        <OfficialCoin />
      </Section>

      <Section id="how" eyebrow="How it works" title="Three steps. No jargon.">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card relative p-6">
              <span className="num flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft font-display text-lg font-semibold text-accent-strong">
                {s.n}
              </span>
              <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-ink-2">
          Want the details? <Link href="/how-it-works" className="font-semibold text-accent-strong underline underline-offset-4">Read how it works</Link>.
        </p>
      </Section>

      <Section
        id="calculator"
        eyebrow="Try it"
        title="See what a lock could earn"
        intro="Slide the lock length and see how your share changes. It starts at the longest lock, a full year."
      >
        <Calculator />
      </Section>

      <Section id="stats" eyebrow="Right now" title="Clasp in numbers">
        <div className="card p-6 sm:p-8">
          <HomeStats />
        </div>
      </Section>

      <Section
        id="money"
        eyebrow="Where the money comes from"
        title="Real trading fees, not printed coins"
        intro="Nothing is minted to pay you. Every bit of ETH lockers earn was paid by someone trading the coin."
      >
        <MoneyFlow />
      </Section>

      <Section id="risks" eyebrow="Be careful" title="What can go wrong">
        <div className="rounded-[var(--radius-card)] border border-warn-line bg-warn-soft/70 p-6 sm:p-8">
          <ul className="grid gap-5 md:grid-cols-2">
            {RISKS.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden="true" className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn text-sm font-bold text-white">
                  !
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-ink-2">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ink-2">
            More on this in <Link href="/security" className="font-semibold text-ink underline underline-offset-4">Security &amp; risks</Link>.
          </p>
        </div>
      </Section>

      <Section id="faq" eyebrow="Questions" title="Good questions, straight answers">
        <Faq />
        <p className="mt-4 text-sm text-ink-3">
          Numbers above are Clasp’s default rules. Each coin’s vault keeps the rules it was created with, shown on the coin’s page.
        </p>
      </Section>
    </>
  );
}

function HeroArt() {
  const chips = [
    { text: 'Earn ETH from every trade', className: 'top-4 -left-6' },
    { text: 'Up to 4× for a 1-year lock', className: 'bottom-20 -right-10' },
    { text: 'Collect anytime', className: 'bottom-2 left-4' },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto hidden aspect-square w-full max-w-sm animate-rise [animation-delay:120ms] lg:block">
      <div className="absolute inset-8 rounded-full border border-line bg-card shadow-[var(--shadow-lift)]" />
      <div className="absolute inset-20 rounded-full bg-accent-tint" />
      <div className="absolute inset-0 flex items-center justify-center">
        <LogoMark className="h-32 w-32" />
      </div>
      {chips.map((c) => (
        <span key={c.text} className={`card absolute px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${c.className}`}>
          {c.text}
        </span>
      ))}
    </div>
  );
}
