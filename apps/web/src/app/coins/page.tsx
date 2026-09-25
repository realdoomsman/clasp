import type { Metadata } from 'next';
import { CoinsBrowser } from './CoinsBrowser';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Browse coins',
  description: 'Every coin with a Clasp vault: what lockers earn, how much is locked and by how many people.',
};

export default function CoinsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Coins" title="Find a coin to lock">
        Every coin here has its own Clasp vault. Its trading fees are shared, in ETH, by the people who lock it.
      </PageHeader>
      <CoinsBrowser />
    </div>
  );
}
