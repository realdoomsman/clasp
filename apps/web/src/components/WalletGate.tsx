'use client';

import type { ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/auth';
import { Button } from './ui';

/** Renders `children` only once a wallet is available; otherwise a log-in button. */
export function WalletGate({ children, action = 'continue', className = 'w-full' }: { children: ReactNode; action?: string; className?: string }) {
  const auth = useAuth();
  const { address } = useAccount();
  if (address) return <>{children}</>;
  return (
    <div>
      <Button
        size="lg"
        className={className}
        busy={!auth.ready || (auth.authenticated && !address)}
        disabled={!!auth.unavailableReason}
        onClick={auth.login}
      >
        {auth.mode === 'privy' ? `Log in to ${action}` : `Connect a wallet to ${action}`}
      </Button>
      {auth.unavailableReason ? (
        <p className="hint mt-2 text-center">{auth.unavailableReason}</p>
      ) : (
        auth.mode === 'privy' && <p className="hint mt-2 text-center">Email, Google, or a wallet like MetaMask.</p>
      )}
    </div>
  );
}
