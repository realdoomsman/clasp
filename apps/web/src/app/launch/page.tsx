import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { LaunchForm } from './LaunchForm';

export const metadata: Metadata = {
  title: 'Launch a coin',
  description: 'Launch a coin on Pons with a Clasp vault built in, so its creator fees and trading fees pay the people who lock it.',
};

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Launch" title="Launch a coin that pays its holders">
        Your coin launches on Pons with its own Clasp vault. Its creator fees and Clasp’s 2% trading fee go to the people
        who lock it — including you, if you lock part of your first buy.
      </PageHeader>
      <LaunchForm />
    </div>
  );
}
