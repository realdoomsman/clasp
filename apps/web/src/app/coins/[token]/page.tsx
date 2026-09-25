import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAddress, isAddress } from 'viem';
import type { CoinDetail } from '@/lib/api';
import { API_URL } from '@/lib/env';
import { CoinView } from './CoinView';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  if (!isAddress(token)) return { title: 'Coin not found' };
  try {
    const res = await fetch(`${API_URL}/api/coins/${token}`, { signal: AbortSignal.timeout(2500), cache: 'no-store' });
    if (!res.ok) return { title: 'Coin' };
    const coin = (await res.json()) as CoinDetail;
    return {
      title: `${coin.name} ($${coin.symbol})`,
      description: `Lock ${coin.symbol} on Clasp and earn a share of its trading fees in ETH.`,
    };
  } catch {
    return { title: 'Coin' };
  }
}

export default async function CoinPage({ params }: Props) {
  const { token } = await params;
  if (!isAddress(token)) notFound();
  return <CoinView token={getAddress(token)} />;
}
