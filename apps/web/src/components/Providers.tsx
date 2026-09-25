'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { http, createConfig, injected, useAccount, useDisconnect, WagmiProvider } from 'wagmi';
import { AuthContext, type Auth } from '@/lib/auth';
import { robinhood } from '@/lib/chain';
import { RPC_URL } from '@/lib/env';
import { ConnectWalletDialog } from './ConnectWalletDialog';

const transports = { [robinhood.id]: http(RPC_URL, { batch: true }) };

function AuthBridge({ children }: { children: ReactNode }) {
  const { status } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [picking, setPicking] = useState(false);
  const auth = useMemo<Auth>(
    () => ({
      ready: status !== 'reconnecting',
      login: () => setPicking(true),
      logout: async () => {
        await disconnectAsync();
      },
    }),
    [status, disconnectAsync],
  );
  return (
    <AuthContext.Provider value={auth}>
      {children}
      <ConnectWalletDialog open={picking} onClose={() => setPicking(false)} />
    </AuthContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  // Installed wallets are discovered through EIP-6963 (wagmi's default); `injected()`
  // covers older wallets that only set window.ethereum.
  const [config] = useState(() => createConfig({ chains: [robinhood], transports, connectors: [injected()], ssr: true }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthBridge>{children}</AuthBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
