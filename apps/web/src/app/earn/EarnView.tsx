'use client';

import { claspVaultAbi } from '@clasp/sdk';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Address } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { TxStatus } from '@/components/TxStatus';
import { Button, ButtonLink, Card, EmptyState, ErrorState, Notice, Skeleton, Stat } from '@/components/ui';
import { WalletGate } from '@/components/WalletGate';
import { api, type Position } from '@/lib/api';
import { robinhood } from '@/lib/chain';
import { formatEth } from '@/lib/format';
import { useTx } from '@/lib/tx';
import { PositionCard } from './PositionCard';

/** One claimAll per vault, sent one after another. */
function CollectAll({ positions }: { positions: Position[] }) {
  const tx = useTx();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const byVault = new Map<Address, bigint[]>();
  for (const p of positions) {
    if (BigInt(p.pending) === 0n) continue;
    byVault.set(p.vault, [...(byVault.get(p.vault) ?? []), BigInt(p.id)]);
  }
  const total = positions.reduce((sum, p) => sum + BigInt(p.pending), 0n);

  async function collect() {
    const groups = [...byVault.entries()];
    for (const [i, [vault, ids]] of groups.entries()) {
      setProgress({ done: i, total: groups.length });
      const receipt = await tx.send({ address: vault, abi: claspVaultAbi, functionName: 'claimAll', args: [ids] });
      if (!receipt) break;
    }
    setProgress(null);
  }

  return (
    <div>
      <Button size="lg" onClick={collect} disabled={total === 0n} busy={tx.busy} className="w-full sm:w-auto">
        {total === 0n ? 'Nothing to collect yet' : `Collect ${formatEth(total)}`}
      </Button>
      {progress && progress.total > 1 && (
        <p className="hint mt-2">
          Coin {progress.done + 1} of {progress.total}: each coin’s vault is a separate confirmation.
        </p>
      )}
      <TxStatus state={tx.state} success="Collected! The ETH is in your wallet." />
    </div>
  );
}

/** ETH a vault couldn't send you (e.g. your wallet refused it) waits in `owed`. */
function OwedNotice({ owner, vaults }: { owner: Address; vaults: Address[] }) {
  const tx = useTx();
  const owed = useReadContracts({
    contracts: vaults.map((vault) => ({
      address: vault,
      abi: claspVaultAbi,
      functionName: 'owed' as const,
      args: [owner] as const,
      chainId: robinhood.id,
    })),
    query: { enabled: vaults.length > 0 },
  });
  const waiting = vaults
    .map((vault, i) => ({ vault, amount: (owed.data?.[i]?.result as bigint | undefined) ?? 0n }))
    .filter((v) => v.amount > 0n);
  if (waiting.length === 0) return null;
  return (
    <Notice tone="info" title="Some ETH couldn’t be sent to your wallet automatically">
      <p>It’s safe and waiting for you. Withdraw it to this wallet:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {waiting.map((w) => (
          <Button
            key={w.vault}
            size="sm"
            busy={tx.busy}
            onClick={async () => {
              await tx.send({ address: w.vault, abi: claspVaultAbi, functionName: 'withdrawOwed', args: [owner] });
              await owed.refetch();
            }}
          >
            Withdraw {formatEth(w.amount)}
          </Button>
        ))}
      </div>
      <TxStatus state={tx.state} success="Withdrawn." />
    </Notice>
  );
}

function Portfolio({ address }: { address: Address }) {
  const query = useQuery({ queryKey: ['wallet', address], queryFn: () => api.wallet(address), refetchInterval: 15_000 });
  // Unlock summaries live here, not on the card: a closed lock's card disappears on the next refresh.
  const [unlocks, setUnlocks] = useState<string[]>([]);
  const addUnlock = (message: string) => setUnlocks((list) => [message, ...list]);
  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} what="your locks" />;

  const { positions, totals } = query.data;
  const sorted = [...positions].sort((a, b) => Number(b.matured) - Number(a.matured) || a.lockEnd - b.lockEnd);
  const vaults = [...new Set(positions.map((p) => p.vault))];

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-sm text-ink-3">Ready to collect</p>
              <p className="num font-display text-3xl font-semibold text-accent-strong sm:text-4xl">{formatEth(totals.pending)}</p>
            </div>
            <Stat label="Collected so far" value={formatEth(totals.claimed)} />
            <Stat label="Value of your locks" value={formatEth(totals.lockedValueEth)} />
          </div>
          <CollectAll positions={positions} />
        </div>
      </Card>

      {unlocks.map((message, i) => (
        <Notice key={`${i}-${message}`} tone="good" title="Unlocked">
          <div className="flex items-start justify-between gap-3">
            <p>{message}</p>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold underline"
              onClick={() => setUnlocks((list) => list.filter((m) => m !== message))}
            >
              Dismiss
            </button>
          </div>
        </Notice>
      ))}

      <OwedNotice owner={address} vaults={vaults} />

      {positions.length === 0 ? (
        <EmptyState title="You haven’t locked anything yet">
          <p>Pick a coin, lock it, and your share of its trading fees shows up here.</p>
          <ButtonLink href="/coins" size="sm" className="mt-4">
            Browse coins
          </ButtonLink>
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {sorted.map((p) => (
            <li key={`${p.vault}-${p.id}`}>
              <PositionCard position={p} onUnlocked={addUnlock} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EarnView() {
  const { address } = useAccount();
  if (!address) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center sm:p-8">
        <p className="font-display text-xl font-semibold">Log in to see your locks</p>
        <p className="mt-1 mb-5 text-sm text-ink-2">Your locks and the ETH they’ve earned will show up here.</p>
        <WalletGate action="see your locks">{null}</WalletGate>
      </Card>
    );
  }
  return <Portfolio address={address} />;
}
