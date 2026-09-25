'use client';

import { createContext, useContext } from 'react';

export type Auth = {
  /** false until the login provider has restored any previous session */
  ready: boolean;
  /** logged in (Privy) or wallet connected (wallet-only mode) */
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  /** 'privy' offers email, Google and wallets; 'wallet' is the browser-wallet-only mode used when no Privy app id is configured */
  mode: 'privy' | 'wallet';
  /** set when login cannot work, e.g. no browser wallet installed in wallet-only mode */
  unavailableReason: string | null;
};

export const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <Providers>');
  return auth;
}
