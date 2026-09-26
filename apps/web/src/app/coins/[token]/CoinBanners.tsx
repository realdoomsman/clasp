'use client';

import Link from 'next/link';
import { Notice } from '@/components/ui';
import type { CoinDetail } from '@/lib/api';
import { explorerAddress } from '@/lib/chain';
import { formatDate, formatRelative, shortAddress } from '@/lib/format';

/** Warnings about the coin's Pons creator fees: a pending admin redirect, or fees no longer reaching the vault. */
export function CoinBanners({ coin }: { coin: CoinDetail }) {
  const redirect = coin.adminRedirectPending;

  return (
    <div className="space-y-3">
      {redirect && (
        <Notice tone="bad" title="Pons’s admin has proposed redirecting this coin’s creator fees">
          <p>
            The Pons launchpad’s admin wants to send {coin.symbol}’s Pons creator fees to{' '}
            <a href={explorerAddress(redirect.newRecipient)} target="_blank" rel="noreferrer" className="num">
              {shortAddress(redirect.newRecipient)}
            </a>{' '}
            instead of this vault. It can happen from <strong>{formatDate(redirect.executableAt, true)}</strong> (
            {formatRelative(redirect.executableAt)}) until {formatDate(redirect.expiresAt, true)}.
          </p>
          <p className="mt-1">
            If it goes through, those fees stop reaching lockers. Clasp’s 2% trading fee keeps coming, and locked coins and
            ETH already earned are not affected. <Link href="/security#pons-admin">Why this is possible</Link>.
          </p>
        </Notice>
      )}
      {!coin.feeRecipientOk && (
        <Notice tone="warn" title="This coin’s Pons creator fees aren’t going to its vault">
          <p>
            Right now they go to{' '}
            <a href={explorerAddress(coin.feeRecipient)} target="_blank" rel="noreferrer" className="num">
              {shortAddress(coin.feeRecipient)}
            </a>
            . Lockers still earn Clasp’s 2% trading fee, but not the creator fees. <Link href="/security#pons-admin">Why this can happen</Link>.
          </p>
        </Notice>
      )}
    </div>
  );
}
