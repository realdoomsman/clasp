'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/auth';
import { explorerAddress } from '@/lib/chain';
import { shortAddress } from '@/lib/format';
import { Button, Skeleton } from './ui';

export function ConnectButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const auth = useAuth();
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  if (!auth.authenticated) {
    return (
      <Button size={size} onClick={auth.login} disabled={!!auth.unavailableReason} title={auth.unavailableReason ?? undefined}>
        {auth.mode === 'privy' ? 'Log in' : 'Connect wallet'}
      </Button>
    );
  }

  if (!address) {
    return (
      <Button size={size} variant="secondary" busy>
        Setting up wallet
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
        <div role="menu" className="card absolute right-0 z-50 mt-2 w-56 animate-fade p-1.5">
          <button
            role="menuitem"
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper-2"
            onClick={async () => {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied!' : 'Copy address'}
          </button>
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
            {auth.mode === 'privy' ? 'Log out' : 'Disconnect'}
          </button>
        </div>
      )}
    </div>
  );
}
