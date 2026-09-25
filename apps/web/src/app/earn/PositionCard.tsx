'use client';

import { claspVaultAbi } from '@clasp/sdk';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { erc20Abi, parseEventLogs, type TransactionReceipt } from 'viem';
import { useReadContract } from 'wagmi';
import { AmountInput, parseAmount } from '@/components/AmountInput';
import { DurationPicker } from '@/components/DurationPicker';
import { TxStatus } from '@/components/TxStatus';
import { Badge, Button, Card, Spinner, TokenAvatar } from '@/components/ui';
import { useTokenAccess } from '@/lib/allowance';
import type { Position } from '@/lib/api';
import { robinhood } from '@/lib/chain';
import { formatDate, formatDuration, formatEth, formatMultiplier, formatPercent, formatRelative, formatTokens, sharePct } from '@/lib/format';
import { useTx } from '@/lib/tx';

type Panel = 'none' | 'extend' | 'increase';

function Extend({ position, onDone }: { position: Position; onDone: () => void }) {
  const tx = useTx();
  const terms = useReadContract({ address: position.vault, abi: claspVaultAbi, functionName: 'terms', chainId: robinhood.id });
  const now = Math.floor(Date.now() / 1000);
  const min = terms.data ? Number(terms.data.minLockSecs) : 0;
  const max = terms.data ? Number(terms.data.maxLockSecs) : 0;
  const [secs, setSecs] = useState<number | null>(null);
  const chosen = secs ?? max;
  const preview = useReadContract({
    address: position.vault,
    abi: claspVaultAbi,
    functionName: 'previewMultiplier',
    args: [BigInt(position.amount), BigInt(chosen)],
    chainId: robinhood.id,
    query: { enabled: chosen > 0 },
  });
  const later = now + chosen > position.lockEnd;

  if (terms.isError) return <p className="text-sm text-bad">Couldn’t read this vault’s rules from the chain. Try again in a moment.</p>;
  if (!terms.data) return <Spinner />;
  return (
    <div className="space-y-4">
      <DurationPicker label="New lock length, from today" value={chosen} onChange={setSecs} min={min} max={max} minEnd={position.lockEnd} />
      <p className="num text-sm text-ink-2">
        New boost:{' '}
        <strong className="text-ink">{preview.data ? formatMultiplier(preview.data[0]) : '…'}</strong> (now{' '}
        {formatMultiplier(position.multiplierBps)}). Locking longer restarts the clock, so leaving early would again cost the
        full rate.
      </p>
      {!later && <p className="text-sm text-bad">Pick a length that ends after {formatDate(position.lockEnd)}.</p>}
      <Button
        disabled={!later}
        busy={tx.busy}
        onClick={async () => {
          const r = await tx.send({ address: position.vault, abi: claspVaultAbi, functionName: 'extend', args: [BigInt(position.id), BigInt(chosen)] });
          if (r) onDone();
        }}
      >
        Lock until {formatDate(now + chosen)}
      </Button>
      <TxStatus state={tx.state} success="Done! Your lock runs longer now." />
    </div>
  );
}

function Increase({ position, onDone }: { position: Position; onDone: () => void }) {
  const [text, setText] = useState('');
  const { balance, allowance, refetch } = useTokenAccess(position.token, position.vault);
  const approve = useTx();
  const tx = useTx();
  const amount = parseAmount(text);
  const preview = useReadContract({
    address: position.vault,
    abi: claspVaultAbi,
    functionName: 'previewIncrease',
    args: amount ? [BigInt(position.id), amount] : undefined,
    chainId: robinhood.id,
    query: { enabled: amount !== null },
  });
  const tooMuch = amount !== null && balance !== undefined && amount > balance;
  const needsApproval = amount !== null && (allowance ?? 0n) < amount;
  const left = Math.max(0, position.lockEnd - Math.floor(Date.now() / 1000));

  return (
    <div className="space-y-4">
      <AmountInput
        label="Coins to add"
        value={text}
        onChange={setText}
        unit={position.symbol}
        balance={balance}
        error={text && amount === null ? 'Enter a number.' : tooMuch ? `You only have ${formatTokens(balance)} ${position.symbol}.` : null}
      />
      <p className="num text-sm text-ink-2">
        Added coins unlock with the rest on {formatDate(position.lockEnd)} and count for the {formatDuration(left)} left.
        {preview.data && (
          <>
            {' '}
            New boost: <strong className="text-ink">{formatMultiplier(preview.data[0])}</strong>.
          </>
        )}
      </p>
      {needsApproval && approve.state.status !== 'success' ? (
        <>
          <Button
            disabled={tooMuch}
            busy={approve.busy}
            onClick={async () => {
              const r = await approve.send({ address: position.token, abi: erc20Abi, functionName: 'approve', args: [position.vault, amount] });
              if (r) await refetch();
            }}
          >
            Step 1 of 2: Allow adding {formatTokens(amount)} {position.symbol}
          </Button>
          <TxStatus state={approve.state} />
        </>
      ) : (
        <>
          <Button
            disabled={amount === null || tooMuch || needsApproval}
            busy={tx.busy}
            onClick={async () => {
              if (!amount) return;
              const r = await tx.send({ address: position.vault, abi: claspVaultAbi, functionName: 'increase', args: [BigInt(position.id), amount] });
              if (r) onDone();
            }}
          >
            Add to lock
          </Button>
          <TxStatus state={tx.state} success="Added!" />
        </>
      )}
    </div>
  );
}

/** One sentence about what an unlock returned, read from the vault's events in the receipt. */
function describeUnlock(receipt: TransactionReceipt, p: Position): string {
  const logs = receipt.logs.filter((l) => l.address.toLowerCase() === p.vault.toLowerCase());
  const unlocked = parseEventLogs({ abi: claspVaultAbi, eventName: 'Unlocked', logs }).find((e) => e.args.id === BigInt(p.id));
  const paid = parseEventLogs({ abi: claspVaultAbi, eventName: 'Claimed', logs })
    .filter((e) => e.args.id === BigInt(p.id))
    .reduce((sum, e) => sum + e.args.amount, 0n);
  if (!unlocked) return `Lock #${p.id} is closed. Your ${p.symbol} is back in your wallet.`;
  const { amount, burned, forfeited } = unlocked.args;
  const parts = [`${formatTokens(amount)} ${p.symbol} back in your wallet`];
  if (burned > 0n) parts.push(`${formatTokens(burned)} ${p.symbol} burned`);
  if (paid > 0n) parts.push(`${formatEth(paid)} collected`);
  if (forfeited > 0n) parts.push(`${formatEth(forfeited)} of uncollected ETH returned to the other lockers`);
  return `Unlocked lock #${p.id}: ${parts.join(', ')}.`;
}

/** Modal confirm step for an early unlock, showing the exact on-chain preview. */
function EarlyUnlockDialog({
  position,
  open,
  onClose,
  onUnlocked,
}: {
  position: Position;
  open: boolean;
  onClose: () => void;
  onUnlocked: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tx = useTx();
  const collect = useTx();
  const preview = useReadContract({
    address: position.vault,
    abi: claspVaultAbi,
    functionName: 'previewEarlyUnlock',
    args: [BigInt(position.id)],
    chainId: robinhood.id,
    query: { enabled: open, refetchInterval: 10_000 },
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const [burn, returned, forfeited] = preview.data ?? [undefined, undefined, undefined];
  const burnPct = burn !== undefined ? sharePct(burn, BigInt(position.amount)) : null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={`early-${position.vault}-${position.id}`}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-[var(--radius-card)] border border-line bg-card p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/40"
    >
      <div className="p-6">
        <h2 id={`early-${position.vault}-${position.id}`} className="text-xl font-semibold">
          Unlock early?
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          This lock ends {formatRelative(position.lockEnd)}. If you wait, you get all your coins back for free. Unlocking
          early burns part of your locked coins and gives up the ETH you haven’t collected yet; ETH you already collected is
          always yours.
        </p>
        {preview.isPending ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-ink-2">
            <Spinner /> Working out the exact cost…
          </div>
        ) : preview.isError ? (
          <p className="mt-5 text-sm text-bad">Couldn’t read the exact cost from the vault. Try again in a moment.</p>
        ) : (
          <dl className="mt-5 divide-y divide-line rounded-2xl border border-line px-4 py-1">
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-sm text-ink-2">You get back</dt>
              <dd className="num font-semibold">
                {formatTokens(returned)} {position.symbol}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-sm text-ink-2">Burned forever</dt>
              <dd className="num font-semibold text-bad">
                {formatTokens(burn)} {position.symbol} ({formatPercent(burnPct, 2)})
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-sm text-ink-2">Uncollected ETH you give up</dt>
              <dd className="num font-semibold text-bad">{formatEth(forfeited)}</dd>
            </div>
          </dl>
        )}
        {forfeited !== undefined && forfeited > 0n && (
          <div className="mt-3 rounded-2xl bg-accent-tint p-3 text-sm text-ink-2">
            Collect your {formatEth(forfeited)} first so you don’t give it up.
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              busy={collect.busy}
              onClick={async () => {
                await collect.send({ address: position.vault, abi: claspVaultAbi, functionName: 'claim', args: [BigInt(position.id)] });
                await preview.refetch();
              }}
            >
              Collect {formatEth(forfeited)} first
            </Button>
            <TxStatus state={collect.state} success="Collected." />
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Keep it locked
          </Button>
          <Button
            variant="danger"
            disabled={burn === undefined || tx.state.status === 'success'}
            busy={tx.busy}
            onClick={async () => {
              const r = await tx.send({ address: position.vault, abi: claspVaultAbi, functionName: 'earlyUnlock', args: [BigInt(position.id)] });
              if (r) onUnlocked(describeUnlock(r, position));
            }}
          >
            {burn !== undefined ? `Unlock and burn ${formatTokens(burn)} ${position.symbol}` : 'Unlock early'}
          </Button>
        </div>
        <TxStatus state={tx.state} success="Unlocked. Your coins are back in your wallet." />
      </div>
    </dialog>
  );
}

/** `onUnlocked` gets a summary that outlives this card (the position disappears once it is closed). */
export function PositionCard({ position: p, onUnlocked }: { position: Position; onUnlocked: (message: string) => void }) {
  const [panel, setPanel] = useState<Panel>('none');
  const [confirming, setConfirming] = useState(false);
  const claim = useTx();
  const unlock = useTx();
  const now = Math.floor(Date.now() / 1000);
  const span = Math.max(1, p.lockEnd - p.lockStart);
  const progress = Math.min(100, Math.max(0, ((now - p.lockStart) / span) * 100));
  const pending = BigInt(p.pending);
  const terms = useReadContract({ address: p.vault, abi: claspVaultAbi, functionName: 'terms', chainId: robinhood.id });
  // The vault only accepts top-ups while at least its shortest lock length is left.
  const minLeft = terms.data ? Number(terms.data.minLockSecs) : null;
  const canAdd = minLeft !== null && p.lockEnd - now >= minLeft;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link href={`/coins/${p.token}`} className="flex items-center gap-3 hover:text-accent-strong">
          <TokenAvatar src={p.image} symbol={p.symbol} size={44} />
          <div>
            <p className="num font-display text-lg font-semibold">
              {formatTokens(p.amount)} {p.symbol}
            </p>
            <p className="num text-sm text-ink-3">
              {formatMultiplier(p.multiplierBps)} boost · lock #{p.id}
            </p>
          </div>
        </Link>
        {p.matured ? <Badge tone="good">Ended — unlock any time</Badge> : <Badge tone="accent">Ends {formatRelative(p.lockEnd)}</Badge>}
      </div>

      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-paper-2"
          role="progressbar"
          aria-label="Time locked so far"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className={`h-full rounded-full ${p.matured ? 'bg-good' : 'bg-accent'}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="num mt-1.5 flex justify-between text-xs text-ink-3">
          <span>Locked {formatDate(p.lockStart)}</span>
          <span>Ends {formatDate(p.lockEnd, true)}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-paper-2/70 p-4">
        <div className="flex gap-8">
          <div>
            <p className="text-sm text-ink-3">Ready to collect</p>
            <p className="num font-display text-xl font-semibold text-accent-strong">{formatEth(p.pending)}</p>
          </div>
          <div>
            <p className="text-sm text-ink-3">Collected</p>
            <p className="num font-display text-xl font-semibold">{formatEth(p.claimed)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.matured ? (
            <Button
              busy={unlock.busy}
              onClick={async () => {
                const r = await unlock.send({ address: p.vault, abi: claspVaultAbi, functionName: 'unlock', args: [BigInt(p.id)] });
                if (r) onUnlocked(describeUnlock(r, p));
              }}
            >
              Unlock {formatTokens(p.amount)} {p.symbol}
              {pending > 0n ? ` + ${formatEth(pending)}` : ''}
            </Button>
          ) : (
            <Button
              disabled={pending === 0n}
              busy={claim.busy}
              onClick={() => claim.send({ address: p.vault, abi: claspVaultAbi, functionName: 'claim', args: [BigInt(p.id)] })}
            >
              Collect
            </Button>
          )}
        </div>
      </div>
      <TxStatus state={claim.state} success="Collected! The ETH is in your wallet." />
      <TxStatus state={unlock.state} success="Unlocked! Your coins and ETH are back in your wallet." />
      {p.matured && (
        <p className="hint mt-3">
          Unlock any time — Clasp’s keeper also unlocks ended locks automatically, largest first. Your coins and ETH only
          ever go to you.
        </p>
      )}

      {!p.matured && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={panel === 'increase' ? 'primary' : 'secondary'}
              aria-expanded={panel === 'increase'}
              disabled={!canAdd}
              title={!canAdd && minLeft !== null ? `Adding needs at least ${formatDuration(minLeft)} left on the lock` : undefined}
              onClick={() => setPanel(panel === 'increase' ? 'none' : 'increase')}
            >
              Add more
            </Button>
            <Button size="sm" variant={panel === 'extend' ? 'primary' : 'secondary'} aria-expanded={panel === 'extend'} onClick={() => setPanel(panel === 'extend' ? 'none' : 'extend')}>
              Lock for longer
            </Button>
            <Button size="sm" variant="ghost" className="text-bad! hover:bg-bad-soft" onClick={() => setConfirming(true)}>
              Unlock early (costs {formatTokens(p.earlyUnlockBurn)} {p.symbol})
            </Button>
          </div>
          {!canAdd && minLeft !== null && (
            <p className="hint mt-2">
              Adding coins needs at least {formatDuration(minLeft)} left on the lock. Lock for longer first, then add more.
            </p>
          )}
          {panel !== 'none' && (
            <div className="mt-4 animate-fade rounded-2xl border border-line p-4">
              {panel === 'extend' ? (
                <Extend position={p} onDone={() => setPanel('none')} />
              ) : (
                <Increase position={p} onDone={() => setPanel('none')} />
              )}
            </div>
          )}
          <EarlyUnlockDialog position={p} open={confirming} onClose={() => setConfirming(false)} onUnlocked={onUnlocked} />
        </>
      )}
    </Card>
  );
}
