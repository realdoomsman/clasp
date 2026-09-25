import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { JoinForm } from './JoinForm';
import { LaunchForm } from './LaunchForm';

export const metadata: Metadata = {
  title: 'Launch a coin',
  description: 'Launch a coin on Pons with a Clasp vault built in, or bring a coin you already launched on Pons.',
};

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Launch" title="Launch a coin that pays its holders">
        Your coin launches on Pons with its own Clasp vault. Its creator fees and Clasp’s 2% trading fee go to the people
        who lock it — including you, if you lock part of your first buy.
      </PageHeader>
      <LaunchForm />
      <section id="join" aria-labelledby="join-title" className="mt-16 scroll-mt-24">
        <p className="text-sm font-semibold tracking-wide text-accent-strong uppercase">Already launched on Pons?</p>
        <h2 id="join-title" className="mt-2 text-3xl font-semibold">Bring your coin to Clasp</h2>
        <p className="mt-2 text-ink-2">
          Two steps: create the coin’s vault (anyone can), then the coin’s current creator-fee recipient points its Pons
          creator fees at the vault.
        </p>
        <div className="mt-6">
          <JoinForm />
        </div>
      </section>
    </div>
  );
}
