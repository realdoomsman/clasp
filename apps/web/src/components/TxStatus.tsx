'use client';

import type { ReactNode } from 'react';
import { explorerTx } from '@/lib/chain';
import { TX_LABELS, type TxState } from '@/lib/tx';
import { Spinner } from './ui';

/** One line under an action button describing where the transaction is. */
export function TxStatus({ state, success = 'Done!' }: { state: TxState; success?: ReactNode }) {
  if (state.status === 'idle') return null;
  const link = 'hash' in state && state.hash && (
    <a href={explorerTx(state.hash)} target="_blank" rel="noreferrer" className="ml-1 underline underline-offset-2">
      View transaction ↗
    </a>
  );
  if (state.status === 'error') {
    return (
      <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
        {state.message}
        {link}
      </p>
    );
  }
  if (state.status === 'success') {
    return (
      <p role="status" className="mt-3 rounded-xl bg-good-soft px-3 py-2 text-sm text-good">
        {success}
        {link}
      </p>
    );
  }
  return (
    <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-2">
      <Spinner />
      {TX_LABELS[state.status]}
      {link}
    </p>
  );
}
