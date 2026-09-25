'use client';

import { getAddress, type Address, type Hash } from 'viem';
import { createConnector } from 'wagmi';
import type { GoogleSessionResponse } from './api-types';
import { robinhood } from './chain';
import { API_URL, RPC_URL } from './env';

/**
 * "Continue with Google": a wallet Clasp creates and holds for a Google
 * account (custodial). Signing happens on the Clasp API; this connector is the
 * EIP-1193 bridge wagmi talks to. Reads go straight to the Robinhood Chain
 * RPC, `eth_sendTransaction` goes to POST /custody/send with the session
 * cookie, and every kind of message signing is refused.
 */

export const GOOGLE_CONNECTOR_ID = 'clasp-google';

export class GoogleWalletError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** EIP-1193 error code, so viem classifies the failure (4100 = unauthorized). */
    readonly code = status === 401 ? 4100 : -32000,
  ) {
    super(message);
  }
}

export async function fetchGoogleSession(): Promise<GoogleSessionResponse> {
  const res = await fetch(`${API_URL}/auth/session`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new GoogleWalletError(`Couldn’t reach Clasp (${res.status})`, res.status);
  return (await res.json()) as GoogleSessionResponse;
}

async function postApi<T>(path: string, body: object = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new GoogleWalletError(json.error ?? `Request failed (${res.status})`, res.status);
  return json;
}

/** Full-page redirect to Google; comes back to `returnPath` with #google-login. */
export function startGoogleLogin(returnPath: string) {
  window.location.assign(`${API_URL}/auth/google/start?return=${encodeURIComponent(returnPath)}`);
}

/** The wallet's private key. Throws GoogleWalletError 403 "reauth" unless Google login was in the last 15 minutes. */
export async function exportGoogleKey(): Promise<Hash> {
  return (await postApi<{ privateKey: Hash }>('/custody/export')).privateKey;
}

type SendTx = { from?: string; to?: string; data?: string; value?: string; gas?: string };

export function googleWallet() {
  return createConnector((config) => {
    let account: Address | undefined;
    let rpcId = 0;

    const provider = {
      async request({ method, params }: { method: string; params?: unknown }): Promise<unknown> {
        switch (method) {
          case 'eth_accounts':
          case 'eth_requestAccounts':
            return account ? [account] : [];
          case 'eth_chainId':
            return `0x${robinhood.id.toString(16)}`;
          case 'wallet_switchEthereumChain': {
            const [{ chainId }] = params as [{ chainId: string }];
            if (Number(chainId) === robinhood.id) return null;
            throw new GoogleWalletError('Google wallets only work on Robinhood Chain.', 400, 4902);
          }
          case 'eth_sendTransaction': {
            const [tx] = params as [SendTx];
            if (!account) throw new GoogleWalletError('Sign in with Google again.', 401);
            if (tx.from && tx.from.toLowerCase() !== account.toLowerCase()) {
              throw new GoogleWalletError('That transaction is not from your Google wallet.', 400, 4100);
            }
            if (!tx.to) throw new GoogleWalletError('Google wallets can’t deploy contracts.', 400, 4200);
            const { hash } = await postApi<{ hash: Hash }>('/custody/send', {
              to: tx.to,
              data: tx.data,
              value: tx.value,
              gas: tx.gas,
            });
            return hash;
          }
          case 'personal_sign':
          case 'eth_sign':
          case 'eth_signTypedData':
          case 'eth_signTypedData_v3':
          case 'eth_signTypedData_v4':
          case 'eth_signTransaction':
            throw new GoogleWalletError('Google wallets on Clasp only send transactions.', 400, 4200);
          default: {
            const res = await fetch(RPC_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params: params ?? [] }),
            });
            const body = (await res.json()) as { result?: unknown; error?: { code: number; message: string; data?: unknown } };
            if (body.error) throw Object.assign(new Error(body.error.message), body.error);
            return body.result;
          }
        }
      },
      on() {},
      removeListener() {},
    };

    return {
      id: GOOGLE_CONNECTOR_ID,
      name: 'Google',
      type: 'claspGoogle',
      async connect() {
        const { user } = await fetchGoogleSession();
        if (!user) throw new GoogleWalletError('Sign in with Google first.', 401);
        account = getAddress(user.address);
        // wagmi's connect() return type is generic over `withCapabilities`; this connector never reports capabilities.
        return { accounts: [account], chainId: robinhood.id } as never;
      },
      async disconnect() {
        account = undefined;
        await postApi('/auth/logout').catch(() => {});
      },
      async getAccounts() {
        return account ? [account] : [];
      },
      async getChainId() {
        return robinhood.id;
      },
      async getProvider() {
        return provider;
      },
      async isAuthorized() {
        return !!(await fetchGoogleSession().catch(() => null))?.user;
      },
      async switchChain({ chainId }) {
        if (chainId !== robinhood.id) throw new GoogleWalletError('Google wallets only work on Robinhood Chain.', 400, 4902);
        return robinhood;
      },
      onAccountsChanged() {},
      onChainChanged() {},
      onDisconnect() {
        account = undefined;
        config.emitter.emit('disconnect');
      },
    };
  });
}
