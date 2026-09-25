'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatEth } from '@/lib/format';

export function HomeStats() {
  const query = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 30_000 });
  const s = query.data;
  const items = [
    { label: 'Paid to lockers', value: s && formatEth(s.paidToLockersEth) },
    { label: 'Fees in the last 24 hours', value: s && formatEth(s.fees24hEth) },
    { label: 'Value locked', value: s && formatEth(s.lockedValueEth) },
    { label: 'Coins', value: s?.coins.toLocaleString('en-US') },
    { label: 'People locking', value: s?.lockers.toLocaleString('en-US') },
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className={item.label === 'Paid to lockers' ? 'col-span-2 sm:col-span-1' : ''}>
            <dt className="text-sm text-ink-3">{item.label}</dt>
            <dd className="num mt-1 font-display text-2xl font-semibold sm:text-3xl">
              {query.isError ? '—' : item.value ?? <Skeleton className="mt-1 h-8 w-24" />}
            </dd>
          </div>
        ))}
      </dl>
      {query.isError && (
        <p className="mt-4 text-sm text-ink-3" role="status">
          Live numbers are unavailable right now. They come from Clasp’s data service, which didn’t answer.
        </p>
      )}
    </div>
  );
}
