'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useConnect, type Connector } from 'wagmi';
import { robinhood } from '@/lib/chain';
import { humanError } from '@/lib/errors';
import { fetchGoogleSession, startGoogleLogin } from '@/lib/google-wallet';
import { Modal } from './Modal';
import { Spinner } from './ui';

/**
 * Wallets to offer: every wallet the browser announces (EIP-6963, one entry
 * each), or wagmi's generic `injected` connector when only an older wallet
 * that sets `window.ethereum` without announcing itself is installed.
 */
function walletChoices(connectors: readonly Connector[]): Connector[] {
  const announced = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected');
  if (announced.length > 0) return announced;
  const generic = connectors.find((c) => c.id === 'injected');
  return generic && 'ethereum' in window ? [generic] : [];
}

function GoogleOption() {
  const session = useQuery({ queryKey: ['google-session'], queryFn: fetchGoogleSession, staleTime: 60_000 });
  if (!session.data?.enabled) return null;
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => startGoogleLogin(window.location.pathname + window.location.search)}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-line px-4 py-3 font-semibold hover:bg-paper-2"
      >
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>
      <p className="hint mt-2">
        Clasp creates a wallet for your Google account and keeps its key for you. You can withdraw or export it any time.
      </p>
      <p className="mt-5 text-center text-xs font-semibold tracking-wide text-ink-3 uppercase">or use your own wallet</p>
    </div>
  );
}

function WalletList({ onConnected }: { onConnected: () => void }) {
  const { connectors, connect, error, isPending, variables } = useConnect();
  const wallets = walletChoices(connectors);

  if (wallets.length === 0) {
    return (
      <div className="space-y-2 text-sm text-ink-2">
        <p className="font-semibold text-ink">No wallet found in this browser.</p>
        <p>Install a browser wallet such as MetaMask or Rabby, then refresh this page.</p>
        <p>On a phone, open this site in your wallet app’s built-in browser.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {wallets.map((wallet) => {
          const busy = isPending && variables?.connector === wallet;
          return (
            <li key={wallet.uid}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => connect({ connector: wallet, chainId: robinhood.id }, { onSuccess: onConnected })}
                className="flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left font-semibold hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {wallet.icon ? (
                  <img src={wallet.icon} alt="" className="h-8 w-8 rounded-lg" />
                ) : (
                  <span aria-hidden="true" className="h-8 w-8 rounded-lg bg-paper-2" />
                )}
                <span className="flex-1">{wallet.id === 'injected' ? 'Browser wallet' : wallet.name}</span>
                {busy && <Spinner />}
              </button>
            </li>
          );
        })}
      </ul>
      {isPending && <p className="hint mt-3">Approve the connection in your wallet.</p>}
      {error && !isPending && <p className="mt-3 text-sm text-bad">{humanError(error)}</p>}
    </>
  );
}

/** Clasp's own sign-in: Google (Clasp-held wallet) or any wallet installed in the browser. */
export function ConnectWalletDialog({ open, notice, onClose }: { open: boolean; notice: string | null; onClose: () => void }) {
  const { reset } = useConnect();
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Sign in to Clasp">
      {notice && <p className="mb-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{notice}</p>}
      <GoogleOption />
      <WalletList onConnected={onClose} />
      <p className="hint mt-4">With your own wallet, Clasp never sees your keys; it only learns your public address.</p>
    </Modal>
  );
}
