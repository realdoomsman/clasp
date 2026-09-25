'use client';

import { claspVaultAbi, durationBps, multiplierBps, sizeBonusBps, weight, type Terms } from '@clasp/sdk';
import Link from 'next/link';
import { useState } from 'react';
import { erc20Abi } from 'viem';
import { AmountInput, parseAmount } from '@/components/AmountInput';
import { DurationPicker } from '@/components/DurationPicker';
import { TxStatus } from '@/components/TxStatus';
import { Button, Card } from '@/components/ui';
import { WalletGate } from '@/components/WalletGate';
import { useTokenAccess } from '@/lib/allowance';
import type { CoinDetail } from '@/lib/api';
import { formatEth, formatMultiplier, formatPercent, formatTokens, sharePct } from '@/lib/format';
import { bpsToPercent } from '@/lib/terms';
import { useTx } from '@/lib/tx';

/** Coins needed for each size-bonus tier, smallest first. */
function sizeTiers(terms: Terms, supply: bigint) {
  return [
    { shareBps: terms.tier1ShareBps, bonusBps: terms.tier1BonusBps },
    { shareBps: terms.tier2ShareBps, bonusBps: terms.tier2BonusBps },
    { shareBps: terms.tier3ShareBps, bonusBps: terms.tier3BonusBps },
  ].map((t) => ({ ...t, minAmount: (supply * BigInt(t.shareBps)) / 10_000n }));
}

export function LockPanel({ coin, terms }: { coin: CoinDetail; terms: Terms }) {
  const [text, setText] = useState('');
  const [secs, setSecs] = useState(Number(terms.maxLockSecs));
  const { balance, allowance, refetch } = useTokenAccess(coin.token, coin.vault);
  const approve = useTx();
  const lock = useTx();

  const amount = parseAmount(text);
  const supply = BigInt(coin.totalSupply);
  const durBps = durationBps(BigInt(secs), BigInt(terms.minLockSecs), BigInt(terms.maxLockSecs));
  const bonusBps = amount ? sizeBonusBps(amount, supply, terms) : 0n;
  const totalBps = multiplierBps(durBps, bonusBps);
  const myWeight = amount ? weight(amount, durBps, bonusBps) : 0n;
  const poolWeight = BigInt(coin.totalWeight) + myWeight;
  const share = myWeight > 0n ? sharePct(myWeight, poolWeight) : 0;
  const weekly = myWeight > 0n ? (BigInt(coin.toLockers7dEth) * myWeight) / poolWeight : 0n;
  const nextTier = sizeTiers(terms, supply).find((t) => (amount ?? 0n) < t.minAmount);

  let error: string | null = null;
  if (text && amount === null) error = 'Enter a number, like 250000.';
  else if (amount !== null && amount < BigInt(terms.minLockAmount))
    error = `The smallest lock is ${formatTokens(BigInt(terms.minLockAmount))} ${coin.symbol}.`;
  else if (amount !== null && balance !== undefined && amount > balance)
    error = `You only have ${formatTokens(balance)} ${coin.symbol}.`;

  const needsApproval = amount !== null && (allowance ?? 0n) < amount;
  const canSubmit = amount !== null && !error;

  async function onApprove() {
    if (!amount) return;
    const receipt = await approve.send({ address: coin.token, abi: erc20Abi, functionName: 'approve', args: [coin.vault, amount] });
    if (receipt) await refetch();
  }

  async function onLock() {
    if (!amount) return;
    const receipt = await lock.send({ address: coin.vault, abi: claspVaultAbi, functionName: 'lock', args: [amount, BigInt(secs)] });
    if (receipt) {
      setText('');
      approve.reset();
      await refetch();
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Lock ${coin.symbol}</h2>
      <p className="mt-1 text-sm text-ink-2">Earn a share of every trade on {coin.name}, paid in ETH.</p>

      <div className="mt-5 space-y-6">
        <AmountInput label="Coins to lock" value={text} onChange={setText} unit={coin.symbol} balance={balance} error={error} />
        <DurationPicker value={secs} onChange={setSecs} min={Number(terms.minLockSecs)} max={Number(terms.maxLockSecs)} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-accent-tint p-4" aria-live="polite">
        <div>
          <dt className="text-sm text-ink-2">Your boost</dt>
          <dd className="num font-display text-2xl font-semibold text-accent-strong">{formatMultiplier(totalBps)}</dd>
          <dd className="num text-xs text-ink-3">
            {formatMultiplier(durBps)} time{bonusBps > 0n ? ` · +${bpsToPercent(bonusBps)} size` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-2">Your share of fees</dt>
          <dd className="num font-display text-2xl font-semibold">{amount ? formatPercent(share, 2) : '—'}</dd>
          <dd className="num text-xs text-ink-3">{amount ? `≈ ${formatEth(weekly)} a week at last week’s pace` : 'Enter an amount'}</dd>
        </div>
      </dl>
      {nextTier && (
        <p className="num mt-2 text-xs text-ink-3">
          Tip: lock {formatTokens(nextTier.minAmount)} or more ({bpsToPercent(nextTier.shareBps)} of the supply) in one go for +
          {bpsToPercent(nextTier.bonusBps)} extra.
        </p>
      )}

      <div className="mt-6">
        <WalletGate action="lock">
          {needsApproval && canSubmit && approve.state.status !== 'success' ? (
            <>
              <Button size="lg" className="w-full" onClick={onApprove} busy={approve.busy}>
                Step 1 of 2: Allow Clasp to lock {formatTokens(amount)} {coin.symbol}
              </Button>
              <p className="hint mt-2">A one-time permission for exactly this amount. Then you’ll confirm the lock.</p>
              <TxStatus state={approve.state} />
            </>
          ) : (
            <>
              <Button size="lg" className="w-full" onClick={onLock} disabled={!canSubmit || needsApproval} busy={lock.busy}>
                {needsApproval ? 'Checking permission…' : `Lock for ${formatMultiplier(totalBps)}`}
              </Button>
              <TxStatus
                state={lock.state}
                success={
                  <>
                    Locked! Track it in{' '}
                    <Link href="/earn" className="font-semibold underline">
                      My locks
                    </Link>
                    .
                  </>
                }
              />
            </>
          )}
        </WalletGate>
      </div>

      <p className="mt-4 text-xs text-ink-3">
        Unlocking before the end burns up to {bpsToPercent(terms.penaltyBps)} of your locked coins (at least{' '}
        {bpsToPercent(terms.minPenaltyBps)}), less the closer you are to the end, and gives up ETH you haven’t collected yet —
        ETH you already collected is always yours. When the lock ends, your coins come back in full.
      </p>
    </Card>
  );
}
