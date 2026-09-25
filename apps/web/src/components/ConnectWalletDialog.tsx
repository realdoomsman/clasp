'use client';

import { useEffect, useRef } from 'react';
import { useConnect, type Connector } from 'wagmi';
import { robinhood } from '@/lib/chain';
import { humanError } from '@/lib/errors';
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
                  // eslint-disable-next-line @next/next/no-img-element -- wallet-provided data: URI
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

/** Clasp's own wallet picker. No third-party login: the site only ever learns your public address. */
export function ConnectWalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { reset } = useConnect();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      reset();
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, reset]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="connect-wallet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="card m-auto w-[min(26rem,calc(100vw-2rem))] p-0 text-ink backdrop:bg-black/40"
    >
      {/* Rendered only while open: the wallet list depends on browser-only state. */}
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="connect-wallet-title" className="font-display text-xl font-semibold">
              Connect a wallet
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-2 hover:bg-paper-2"
            >
              ✕
            </button>
          </div>
          <WalletList onConnected={onClose} />
          <p className="hint mt-4">Clasp never sees your keys. Connecting shares only your public address.</p>
        </div>
      )}
    </dialog>
  );
}
