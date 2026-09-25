'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/auth';
import { explorerAddress } from '@/lib/chain';
import { shortAddress } from '@/lib/format';
import { fetchGoogleSession, GOOGLE_CONNECTOR_ID } from '@/lib/google-wallet';
import { ExportKeyDialog, WithdrawDialog } from './GoogleWalletDialogs';
import { Button, Skeleton } from './ui';

const MENU_ITEM = 'w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper-2';

export function ConnectButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const auth = useAuth();
  const { address, connector } = useAccount();
  const isGoogle = connector?.id === GOOGLE_CONNECTOR_ID;
  const google = useQuery({ queryKey: ['google-session'], queryFn: fetchGoogleSession, enabled: isGoogle, staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState<'withdraw' | 'export' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!auth.ready) return <Skeleton className="h-9 w-24" />;

  if (!address) {
    return (
      <Button size={size} onClick={auth.login}>
        Sign in
      </Button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        size={size}
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="num"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-good" />
        {shortAddress(address)}
      </Button>
      {open && (
        <div role="menu" className="card absolute right-0 z-50 mt-2 w-60 animate-fade p-1.5">
          {isGoogle && (
            <p className="truncate px-3 pt-2 pb-1 text-xs text-ink-3">
              Google wallet{google.data?.user ? ` · ${google.data.user.email}` : ''}
            </p>
          )}
          <button
            role="menuitem"
            type="button"
            className={MENU_ITEM}
            onClick={async () => {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied!' : isGoogle ? 'Copy address (to deposit ETH)' : 'Copy address'}
          </button>
          {isGoogle && (
            <>
              <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => (setOpen(false), setDialog('withdraw'))}>
                Withdraw ETH
              </button>
              <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => (setOpen(false), setDialog('export'))}>
                Export private key
              </button>
            </>
          )}
          <a
            role="menuitem"
            href={explorerAddress(address)}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl px-3 py-2 text-sm hover:bg-paper-2"
          >
            View on explorer ↗
          </a>
          <button
            role="menuitem"
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-bad hover:bg-bad-soft"
            onClick={async () => {
              setOpen(false);
              await auth.logout();
            }}
          >
            {isGoogle ? 'Log out' : 'Disconnect'}
          </button>
        </div>
      )}
      {isGoogle && (
        <>
          <WithdrawDialog open={dialog === 'withdraw'} onClose={() => setDialog(null)} address={address} />
          <ExportKeyDialog open={dialog === 'export'} onClose={() => setDialog(null)} />
        </>
      )}
    </div>
  );
}
