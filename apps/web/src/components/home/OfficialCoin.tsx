'use client';

import { officialCoin } from '@clasp/sdk';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, ButtonLink, Skeleton, Stat, TokenAvatar } from '@/components/ui';
import { api } from '@/lib/api';
import { formatEth, formatPercent, formatTokens, sharePct } from '@/lib/format';

/** The official $CLASP coin: live numbers, the one contract address, and a way in. */
export function OfficialCoin() {
  const query = useQuery({ queryKey: ['coin', officialCoin.token], queryFn: () => api.coin(officialCoin.token), refetchInterval: 20_000 });
  const [copied, setCopied] = useState(false);
  const coin = query.data;
  const lockedPct = coin ? sharePct(BigInt(coin.totalLocked), BigInt(coin.totalSupply)) : null;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-line p-5 sm:p-6">
        {coin ? <TokenAvatar src={coin.image} symbol={coin.symbol} size={56} /> : <Skeleton className="h-14 w-14 rounded-full" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-2xl font-semibold">{coin?.name ?? 'Clasp'}</p>
            <Badge tone="accent">Official</Badge>
          </div>
          <p className="text-ink-3">${coin?.symbol ?? 'CLASP'}, launched on Clasp</p>
        </div>
        <ButtonLink href={`/coins/${officialCoin.token}`}>Lock $CLASP</ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-4 sm:p-6">
        <Stat label="Market cap" value={coin ? formatEth(coin.marketCapEth) : <Skeleton className="h-7 w-20" />} />
        <Stat
          label="Supply locked"
          value={lockedPct !== null ? formatPercent(lockedPct) : <Skeleton className="h-7 w-16" />}
          hint={coin ? `${formatTokens(coin.totalLocked)} CLASP` : undefined}
        />
        <Stat label="Lockers" value={coin ? coin.lockers : <Skeleton className="h-7 w-10" />} />
        <Stat label="Paid to lockers" value={coin ? formatEth(coin.paidToLockers) : <Skeleton className="h-7 w-20" />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper-2/60 px-5 py-4 text-sm sm:px-6">
        <p className="min-w-0 text-ink-2">
          The only official contract:{' '}
          <button
            type="button"
            className="num font-semibold break-all text-ink hover:text-accent-strong"
            onClick={async () => {
              await navigator.clipboard.writeText(officialCoin.token);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="Copy the official $CLASP contract address"
          >
            {copied ? 'Copied!' : officialCoin.token}
          </button>
        </p>
        <p className="text-ink-3">Anyone can make a copy with the same name. Check the address.</p>
      </div>
    </div>
  );
}
