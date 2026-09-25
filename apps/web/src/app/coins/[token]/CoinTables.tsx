'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui';
import { api, type ActivityRow, type CoinDetail } from '@/lib/api';
import { explorerAddress, explorerTx } from '@/lib/chain';
import { formatDuration, formatEth, formatPercent, formatRelative, formatTokens, shortAddress } from '@/lib/format';

function Who({ address }: { address: string | null }) {
  if (!address) return <span>Someone</span>;
  return (
    <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="num font-semibold hover:text-accent-strong">
      {shortAddress(address)}
    </a>
  );
}

function describe(row: ActivityRow, symbol: string) {
  const d = row.data;
  switch (row.kind) {
    case 'lock':
      return (
        <>
          <Who address={row.owner} /> locked {formatTokens(row.amount)} {symbol}
          {d.durationSecs ? ` for ${formatDuration(Number(d.durationSecs))}` : ''}
        </>
      );
    case 'increase':
      return (
        <>
          <Who address={row.owner} /> added {formatTokens(row.amount)} {symbol} to a lock
        </>
      );
    case 'extend':
      return (
        <>
          <Who address={row.owner} /> locked for longer
        </>
      );
    case 'claim':
      return (
        <>
          <Who address={row.owner} /> collected {formatEth(row.amount)}
        </>
      );
    case 'unlock':
      return d.early === true || d.early === 'true' ? (
        <>
          <Who address={row.owner} /> unlocked early and got {formatTokens(row.amount)} {symbol} back ({formatTokens(String(d.burned ?? '0'))}{' '}
          burned)
        </>
      ) : (
        <>
          <Who address={row.owner} /> got {formatTokens(row.amount)} {symbol} back at the end of a lock
        </>
      );
    case 'fees':
      return (
        <>
          {formatEth(row.amount)} of fees arrived
          {d.toLockers ? ` · ${formatEth(String(d.toLockers))} for lockers` : ''}
        </>
      );
    case 'treasury':
      return <>{formatEth(row.amount)} paid to Clasp</>;
  }
}

// 24×24 stroke icons: padlock, plus, clock, coin-out, open padlock, bolt, building.
const ICONS: Record<ActivityRow['kind'], string> = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  increase: 'M12 5v14M5 12h14',
  extend: 'M12 7v5l3 3M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  claim: 'M12 3v12m0 0-4-4m4 4 4-4M5 21h14',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5z',
  fees: 'M13 2 4 14h7l-1 8 9-12h-7z',
  treasury: 'M3 10h18M5 10v9m4-9v9m6-9v9m4-9v9M3 21h18M12 3l9 5H3z',
};

function Lockers({ coin }: { coin: CoinDetail }) {
  const q = useQuery({ queryKey: ['lockers', coin.token], queryFn: () => api.lockers(coin.token), refetchInterval: 30_000 });
  if (q.isPending) return <Skeleton className="h-40" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} what="the lockers" />;
  if (q.data.lockers.length === 0) return <EmptyState title="No lockers yet">Be the first to lock {coin.symbol}.</EmptyState>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">People locking {coin.symbol}</caption>
        <thead className="bg-paper-2 text-ink-2">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Wallet</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Locked</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Share of fees</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Collected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.data.lockers.map((l) => (
            <tr key={l.owner}>
              <td className="px-4 py-3">
                <Who address={l.owner} />
                {l.positions > 1 && <span className="ml-1 text-xs text-ink-3">({l.positions} locks)</span>}
              </td>
              <td className="num px-4 py-3 text-right">{formatTokens(l.amount)}</td>
              <td className="num px-4 py-3 text-right font-semibold">{formatPercent(l.sharePct, 2)}</td>
              <td className="num px-4 py-3 text-right">{formatEth(l.claimed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Activity({ coin }: { coin: CoinDetail }) {
  const q = useQuery({ queryKey: ['activity', coin.token], queryFn: () => api.activity(coin.token), refetchInterval: 20_000 });
  if (q.isPending) return <Skeleton className="h-40" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} what="recent activity" />;
  if (q.data.activity.length === 0) return <EmptyState title="Nothing has happened yet" />;
  return (
    <ul className="card divide-y divide-line">
      {q.data.activity.map((row) => (
        <li key={`${row.txHash}-${row.kind}-${row.id ?? ''}`} className="flex items-start gap-3 px-4 py-3 text-sm">
          <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path d={ICONS[row.kind]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="min-w-0 flex-1 text-ink-2">{describe(row, coin.symbol)}</p>
          <a href={explorerTx(row.txHash)} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-ink-3 hover:text-accent-strong">
            {formatRelative(row.blockTime)}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function CoinTables({ coin }: { coin: CoinDetail }) {
  const [tab, setTab] = useState<'lockers' | 'activity'>('lockers');
  return (
    <section aria-label="Lockers and activity">
      <div className="mb-4">
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'lockers', label: `Lockers (${coin.lockers})` },
            { value: 'activity', label: 'Activity' },
          ]}
        />
      </div>
      {tab === 'lockers' ? <Lockers coin={coin} /> : <Activity coin={coin} />}
    </section>
  );
}
