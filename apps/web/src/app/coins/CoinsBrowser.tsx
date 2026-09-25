'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { CoinCard } from '@/components/CoinCard';
import { ButtonLink, EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui';
import { api, type CoinSort } from '@/lib/api';

const SORTS: { value: CoinSort; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: 'earning', label: 'Most earned' },
  { value: 'locked', label: 'Most locked' },
  { value: 'lockers', label: 'Most lockers' },
];

export function CoinsBrowser() {
  const [sort, setSort] = useState<CoinSort>('new');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ['coins', sort, deferredSearch.trim()],
    queryFn: () => api.coins(sort, deferredSearch),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="coin-search" className="sr-only">
            Search coins
          </label>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            id="coin-search"
            type="search"
            className="field pl-10"
            placeholder="Search by name, ticker or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Segmented label="Sort coins" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} what="the coins" />
      ) : query.data.coins.length === 0 ? (
        deferredSearch.trim() ? (
          <EmptyState title={`No coins match “${deferredSearch.trim()}”`}>Try a ticker or paste the coin’s address.</EmptyState>
        ) : (
          <EmptyState title="No coins yet">
            <p>Be the first: launch a coin with a Clasp vault built in.</p>
            <ButtonLink href="/launch" size="sm" className="mt-4">
              Launch a coin
            </ButtonLink>
          </EmptyState>
        )
      ) : (
        <ul className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
          {query.data.coins.map((coin) => (
            <li key={coin.token}>
              <CoinCard coin={coin} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
