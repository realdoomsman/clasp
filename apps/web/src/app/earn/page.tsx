import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { EarnView } from './EarnView';

export const metadata: Metadata = {
  title: 'My locks',
  description: 'Your Clasp locks, the ETH they have earned, and everything you can do with them.',
};

export default function EarnPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="My locks" title="Your locks and earnings">
        Collect your ETH anytime, unlock when a lock ends, or lock for longer to earn a bigger share.
      </PageHeader>
      <EarnView />
    </div>
  );
}
