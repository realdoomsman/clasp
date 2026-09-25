'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { http, createConfig, injected, useAccount, useConnect, useDisconnect, WagmiProvider } from 'wagmi';
import { AuthContext, type Auth } from '@/lib/auth';
import { robinhood } from '@/lib/chain';
import { RPC_URL } from '@/lib/env';
import { GOOGLE_CONNECTOR_ID, googleWallet } from '@/lib/google-wallet';
import { ConnectWalletDialog } from './ConnectWalletDialog';

const transports = { [robinhood.id]: http(RPC_URL, { batch: true }) };

function AuthBridge({ children }: { children: ReactNode }) {
  const { status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [picker, setPicker] = useState<{ open: boolean; notice: string | null }>({ open: false, notice: null });

  // The API sends people back from Google with #google-login (or #google-login-failed).
  useEffect(() => {
    const hash = window.location.hash;
    if (hash !== '#google-login' && hash !== '#google-login-failed') return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (hash === '#google-login-failed') {
      setPicker({ open: true, notice: 'Google sign-in didn’t finish. Try again, or connect a wallet instead.' });
      return;
    }
    const google = connectors.find((c) => c.id === GOOGLE_CONNECTOR_ID);
    if (google) connect({ connector: google, chainId: robinhood.id });
    // Runs once on arrival; connectors are fixed for the lifetime of the config.
  }, []);

  const auth = useMemo<Auth>(
    () => ({
      ready: status !== 'reconnecting',
      login: () => setPicker({ open: true, notice: null }),
      logout: async () => {
        await disconnectAsync();
      },
    }),
    [status, disconnectAsync],
  );
  return (
    <AuthContext.Provider value={auth}>
      {children}
      <ConnectWalletDialog open={picker.open} notice={picker.notice} onClose={() => setPicker({ open: false, notice: null })} />
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
  // covers older wallets that only set window.ethereum; `googleWallet()` is the
  // Clasp-held wallet behind "Continue with Google".
  const [config] = useState(() =>
    createConfig({ chains: [robinhood], transports, connectors: [injected(), googleWallet()], ssr: true }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthBridge>{children}</AuthBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
