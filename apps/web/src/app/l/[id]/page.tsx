import { COIN_LINK_ID } from '@clasp/sdk';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ButtonLink, EmptyState } from '@/components/ui';
import type { CoinLinkResponse } from '@/lib/api';
import { API_URL } from '@/lib/env';
import { RefreshSoon } from './RefreshSoon';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Opening coin', robots: { index: false } };

/** `https://clasp.fun/l/<id>` is the on-chain website of coins launched here; it opens the coin's page. */
export default async function CoinLinkPage({ params }: Props) {
  const { id } = await params;
  if (!COIN_LINK_ID.test(id)) notFound();

  let token: string | null = null;
  try {
    const res = await fetch(`${API_URL}/api/links/${id}`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (res.ok) token = ((await res.json()) as CoinLinkResponse).token;
  } catch {
    // Data service unreachable: fall through to the waiting screen, which retries.
  }
  // Once a link resolves it never changes (earliest launch wins), so the redirect is permanent.
  if (token) permanentRedirect(`/coins/${token}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <RefreshSoon />
      <EmptyState title="This coin is on its way">
        <p>It was just launched and is still being added to Clasp. This page opens it as soon as it’s ready, usually within a minute.</p>
        <ButtonLink href="/coins" size="sm" variant="secondary" className="mt-4">
          Browse coins
        </ButtonLink>
      </EmptyState>
    </div>
  );
}
