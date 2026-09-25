'use client';

import type { ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/auth';
import { Button } from './ui';

/** Renders `children` only once a wallet is connected; otherwise a sign-in button. */
export function WalletGate({ children, action = 'continue', className = 'w-full' }: { children: ReactNode; action?: string; className?: string }) {
  const auth = useAuth();
  const { address } = useAccount();
  if (address) return <>{children}</>;
  return (
    <Button size="lg" className={className} busy={!auth.ready} onClick={auth.login}>
      Sign in to {action}
    </Button>
  );
}
