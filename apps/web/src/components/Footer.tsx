import Link from 'next/link';
import { LogoMark } from './Logo';

const COLUMNS = [
  {
    title: 'Use Clasp',
    links: [
      { href: '/coins', label: 'Browse coins' },
      { href: '/earn', label: 'My locks' },
      { href: '/launch', label: 'Launch a coin' },
      { href: '/leaderboard', label: 'Leaderboard' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/security', label: 'Security & risks' },
      { href: '/#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-2/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-lg font-semibold">Clasp</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-ink-3">
            Lock a coin you believe in. Earn a share of every trade, paid in ETH. Runs on Robinhood Chain.
          </p>
          <p className="mt-3 max-w-xs text-xs text-ink-3">
            Not audited yet. Memecoins can go to zero. Only lock what you can afford to lose.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-2 hover:text-accent-strong">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
