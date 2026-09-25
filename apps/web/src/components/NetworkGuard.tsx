'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { robinhood } from '@/lib/chain';
import { Button } from './ui';

/** Site-wide banner shown when the connected wallet is on another network. */
export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  if (!isConnected || chainId === undefined || chainId === robinhood.id) return null;
  return (
    <div role="alert" className="border-b border-warn-line bg-warn-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm text-warn sm:px-6">
        <p>
          <strong>Your wallet is on a different network.</strong> Clasp runs on Robinhood Chain.
          {error && <span className="block text-bad">Your wallet didn’t switch. Try switching to Robinhood Chain in the wallet itself.</span>}
        </p>
        <Button size="sm" busy={isPending} onClick={() => switchChain({ chainId: robinhood.id })}>
          Switch to Robinhood Chain
        </Button>
      </div>
    </div>
  );
}
