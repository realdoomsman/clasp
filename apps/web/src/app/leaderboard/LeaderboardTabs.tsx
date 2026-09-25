'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { EmptyState, ErrorState, Segmented, Skeleton, TokenAvatar } from '@/components/ui';
import { api, type Board, type LeaderboardResponse } from '@/lib/api';
import { explorerAddress } from '@/lib/chain';
import { formatDate, formatDuration, formatEth, formatMultiplier, formatTokens, shortAddress } from '@/lib/format';

const BOARDS: { value: Board; label: string }[] = [
  { value: 'earners', label: 'Top earners' },
  { value: 'coins', label: 'Top coins' },
  { value: 'longest', label: 'Longest locks' },
];

function Rank({ n }: { n: number }) {
  const top = n <= 3;
  return (
    <span
      className={`num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        top ? 'bg-accent text-white' : 'bg-paper-2 text-ink-2'
      }`}
    >
      {n}
    </span>
  );
}

function Row({ rank, main, sub, value, valueSub }: { rank: number; main: ReactNode; sub?: ReactNode; value: ReactNode; valueSub?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <Rank n={rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{main}</div>
        {sub && <div className="truncate text-sm text-ink-3">{sub}</div>}
      </div>
      <div className="text-right">
        <div className="num font-display font-semibold">{value}</div>
        {valueSub && <div className="num text-xs text-ink-3">{valueSub}</div>}
      </div>
    </li>
  );
}

function Rows({ data }: { data: LeaderboardResponse }) {
  if (data.rows.length === 0) return <EmptyState title="Nothing here yet">The first locks will show up here.</EmptyState>;
  return (
    <ol className="card divide-y divide-line overflow-hidden">
      {data.board === 'earners' &&
        data.rows.map((r) => (
          <Row
            key={r.owner}
            rank={r.rank}
            main={
              <a href={explorerAddress(r.owner)} target="_blank" rel="noreferrer" className="num hover:text-accent-strong">
                {shortAddress(r.owner)}
              </a>
            }
            sub={`${r.positions} open lock${r.positions === 1 ? '' : 's'}`}
            value={formatEth(r.claimed)}
            valueSub="collected"
          />
        ))}
      {data.board === 'coins' &&
        data.rows.map((r) => (
          <Row
            key={r.token}
            rank={r.rank}
            main={
              <Link href={`/coins/${r.token}`} className="inline-flex items-center gap-2 hover:text-accent-strong">
                <TokenAvatar src={r.image} symbol={r.symbol} size={24} />
                {r.name}
              </Link>
            }
            sub={`$${r.symbol} · ${r.lockers} locker${r.lockers === 1 ? '' : 's'} · ${formatEth(r.lockedValueEth)} locked`}
            value={formatEth(r.paidToLockers)}
            valueSub="paid to lockers"
          />
        ))}
      {data.board === 'longest' &&
        data.rows.map((r) => (
          <Row
            key={`${r.token}-${r.id}`}
            rank={r.rank}
            main={
              <Link href={`/coins/${r.token}`} className="inline-flex items-center gap-2 hover:text-accent-strong">
                <TokenAvatar src={r.image} symbol={r.symbol} size={24} />
                {formatTokens(r.amount)} ${r.symbol}
              </Link>
            }
            sub={
              <span className="num">
                {shortAddress(r.owner)} · until {formatDate(r.lockEnd)}
              </span>
            }
            value={formatDuration(r.durationSecs)}
            valueSub={`${formatMultiplier(r.multiplierBps)} boost`}
          />
        ))}
    </ol>
  );
}

export function LeaderboardTabs() {
  const [board, setBoard] = useState<Board>('earners');
  const query = useQuery({ queryKey: ['leaderboard', board], queryFn: () => api.leaderboard(board), refetchInterval: 60_000 });
  return (
    <div>
      <div className="mb-5">
        <Segmented label="Leaderboard" options={BOARDS} value={board} onChange={setBoard} />
      </div>
      {query.isPending ? (
        <div className="card space-y-3 p-5" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} what="the leaderboard" />
      ) : (
        <Rows data={query.data} />
      )}
    </div>
  );
}
