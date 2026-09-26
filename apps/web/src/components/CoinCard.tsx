import { officialCoin } from '@clasp/sdk';
import Link from 'next/link';
import type { CoinSummary } from '@/lib/api';
import { formatEth, formatPercent, sharePct } from '@/lib/format';
import { Badge, TokenAvatar } from './ui';

export function CoinCard({ coin }: { coin: CoinSummary }) {
  const lockedPct = sharePct(BigInt(coin.totalLocked), BigInt(coin.totalSupply || '0'));
  return (
    <Link
      href={`/coins/${coin.token}`}
      className="card group block p-5 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-center gap-3">
        <TokenAvatar src={coin.image} symbol={coin.symbol} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold group-hover:text-accent-strong">{coin.name}</p>
          <p className="truncate text-sm text-ink-3">${coin.symbol}</p>
        </div>
        {coin.token === officialCoin.token && <Badge tone="accent">Official</Badge>}
        {coin.graduated && <Badge tone="neutral">On Uniswap</Badge>}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-ink-3">Yearly rate</dt>
          <dd className="num mt-0.5 font-display text-lg font-semibold text-accent-strong">{formatPercent(coin.apr)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Supply locked</dt>
          <dd className="num mt-0.5 font-display text-lg font-semibold">{formatPercent(lockedPct)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Lockers</dt>
          <dd className="num mt-0.5 font-display text-lg font-semibold">{coin.lockers}</dd>
        </div>
      </dl>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper-2" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, lockedPct)}%` }} />
      </div>
      <p className="num mt-3 text-xs text-ink-3">
        {formatEth(coin.paidToLockers)} paid to lockers so far
      </p>
    </Link>
  );
}
