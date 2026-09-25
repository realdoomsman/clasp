'use client';

import { createContext, useContext } from 'react';

export type Auth = {
  /** false while wagmi restores a previous connection on page load */
  ready: boolean;
  /** opens Clasp's wallet picker */
  login: () => void;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <Providers>');
  return auth;
}
