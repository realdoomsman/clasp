import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { LeaderboardTabs } from './LeaderboardTabs';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Top earners, the coins paying their lockers the most, and the longest locks on Clasp.',
};

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Leaderboard" title="Who’s earning on Clasp">
        The wallets that have collected the most ETH, the coins that pay their lockers the most, and the longest
        locks.
      </PageHeader>
      <LeaderboardTabs />
    </div>
  );
}
