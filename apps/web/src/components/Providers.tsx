'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { createConfig as createPrivyWagmiConfig, WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { http, createConfig, injected, useAccount, useConnect, useDisconnect, WagmiProvider } from 'wagmi';
import { AuthContext, type Auth } from '@/lib/auth';
import { robinhood } from '@/lib/chain';
import { PRIVY_APP_ID, RPC_URL, WALLETCONNECT_PROJECT_ID } from '@/lib/env';
import { LogoMark } from './Logo';

const transports = { [robinhood.id]: http(RPC_URL, { batch: true }) };

function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const auth = useMemo<Auth>(
    () => ({ ready, authenticated, login: () => login(), logout, mode: 'privy', unavailableReason: null }),
    [ready, authenticated, login, logout],
  );
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

const subscribeNoop = () => () => {};

function WalletAuthBridge({ children }: { children: ReactNode }) {
  const { isConnected, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const hasWallet = useSyncExternalStore(
    subscribeNoop,
    () => typeof window !== 'undefined' && 'ethereum' in window,
    () => true,
  );
  const auth = useMemo<Auth>(
    () => ({
      ready: status !== 'reconnecting' && status !== 'connecting',
      authenticated: isConnected,
      login: () => {
        const connector = connectors[0];
        if (connector) connect({ connector, chainId: robinhood.id });
      },
      logout: () => disconnectAsync(),
      mode: 'wallet',
      unavailableReason: hasWallet ? null : 'Install a browser wallet such as MetaMask or Rabby to connect.',
    }),
    [status, isConnected, connectors, connect, disconnectAsync, hasWallet],
  );
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  const [privyWagmiConfig] = useState(() =>
    PRIVY_APP_ID ? createPrivyWagmiConfig({ chains: [robinhood], transports, ssr: true }) : null,
  );
  const [walletConfig] = useState(() =>
    PRIVY_APP_ID ? null : createConfig({ chains: [robinhood], transports, connectors: [injected()], ssr: true }),
  );

  if (privyWagmiConfig) {
    return (
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['email', 'google', 'wallet'],
          appearance: {
            theme: 'light',
            accentColor: '#3d3bf3',
            logo: <LogoMark className="h-10 w-10" />,
            landingHeader: 'Log in to Clasp',
            walletChainType: 'ethereum-only',
            walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets', 'wallet_connect'],
          },
          embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
          defaultChain: robinhood,
          supportedChains: [robinhood],
          ...(WALLETCONNECT_PROJECT_ID ? { walletConnectCloudProjectId: WALLETCONNECT_PROJECT_ID } : {}),
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig}>
            <PrivyAuthBridge>{children}</PrivyAuthBridge>
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }

  return (
    <WagmiProvider config={walletConfig!}>
      <QueryClientProvider client={queryClient}>
        <WalletAuthBridge>{children}</WalletAuthBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
