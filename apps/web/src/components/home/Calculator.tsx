'use client';

import { DEFAULT_TERMS, durationBps, multiplierBps, sizeBonusBps, weight } from '@clasp/sdk';
import { useId, useState } from 'react';
import { DurationPicker } from '@/components/DurationPicker';
import { Segmented } from '@/components/ui';
import { formatDuration, formatMultiplier, formatPercent } from '@/lib/format';

const SUPPLY = 1_000_000_000; // a typical Pons coin
const WEI = 10n ** 18n;
const TRADING_FEE = 0.02;
const OTHERS_LOCKED_SHARE = 0.2; // assume others lock 20% of supply…
const OTHERS_AVG_BPS = 20_000n; // …at an average 2× boost

type Busy = 'quiet' | 'steady' | 'busy';
const BUSY: Record<Busy, { label: string; ethPerDay: number }> = {
  quiet: { label: 'Quiet', ethPerDay: 1 },
  steady: { label: 'Steady', ethPerDay: 10 },
  busy: { label: 'Busy', ethPerDay: 50 },
};

function formatEthNumber(n: number): string {
  if (n === 0) return '0 ETH';
  if (n < 0.0001) return '<0.0001 ETH';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: n < 1 ? 4 : 2 }).format(n)} ETH`;
}

export function Calculator() {
  const amountId = useId();
  const minSecs = Number(DEFAULT_TERMS.minLockSecs);
  const maxSecs = Number(DEFAULT_TERMS.maxLockSecs);
  const [amount, setAmount] = useState(10_000_000);
  const [secs, setSecs] = useState(maxSecs);
  const [busy, setBusy] = useState<Busy>('steady');

  // whole coins, capped at the example supply
  const amountWei = BigInt(Math.floor(Math.min(amount, SUPPLY))) * WEI;
  const supplyWei = BigInt(SUPPLY) * WEI;

  const durBps = durationBps(BigInt(secs), BigInt(minSecs), BigInt(maxSecs));
  const bonusBps = sizeBonusBps(amountWei, supplyWei, DEFAULT_TERMS);
  const totalBps = multiplierBps(durBps, bonusBps);
  const mine = weight(amountWei, durBps, bonusBps);
  const others = weight(BigInt(Math.round(SUPPLY * OTHERS_LOCKED_SHARE)) * WEI, OTHERS_AVG_BPS, 0n);
  const share = mine === 0n ? 0 : Number((mine * 1_000_000n) / (mine + others)) / 1_000_000;

  const lockerShare = Number(DEFAULT_TERMS.lockerShareBps) / 10_000;
  const perDay = BUSY[busy].ethPerDay * TRADING_FEE * lockerShare * share;
  const days = secs / 86_400;
  const tooSmall = amountWei < BigInt(DEFAULT_TERMS.minLockAmount);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="card space-y-7 p-5 sm:p-7">
        <div>
          <label htmlFor={amountId} className="label">
            Coins you lock
          </label>
          <div className="relative">
            <input
              id={amountId}
              inputMode="numeric"
              className="field num pr-20 text-lg"
              value={amount === 0 ? '' : amount.toLocaleString('en-US')}
              onChange={(e) => setAmount(Math.min(SUPPLY, Number(e.target.value.replace(/\D/g, '').slice(0, 10)) || 0))}
              aria-describedby={`${amountId}-hint`}
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-3">coins</span>
          </div>
          <p id={`${amountId}-hint`} className="hint mt-1.5 num">
            That’s {formatPercent((Math.min(amount, SUPPLY) / SUPPLY) * 100, 3)} of a typical coin’s 1,000,000,000 supply.
          </p>
        </div>

        <DurationPicker value={secs} onChange={setSecs} min={minSecs} max={maxSecs} />

        <div>
          <p className="label" id={`${amountId}-busy`}>
            How much the coin trades
          </p>
          <Segmented
            label="How much the coin trades"
            value={busy}
            onChange={setBusy}
            options={(Object.keys(BUSY) as Busy[]).map((k) => ({ value: k, label: `${BUSY[k].label} · ${BUSY[k].ethPerDay} ETH/day` }))}
          />
        </div>
      </div>

      <div className="flex flex-col rounded-[var(--radius-card)] bg-ink p-6 text-white sm:p-7" aria-live="polite">
        <p className="text-sm text-white/70">Your boost</p>
        <p className="num font-display text-5xl font-semibold tracking-tight sm:text-6xl">{formatMultiplier(totalBps)}</p>
        <ul className="mt-3 space-y-1 text-sm text-white/80">
          <li className="num">
            {formatMultiplier(durBps)} for locking {formatDuration(secs)}
          </li>
          <li className="num">
            {bonusBps > 0n
              ? `+${Number(bonusBps) / 100}% extra for a big lock`
              : 'Lock at least 0.1% of the supply for up to +50% extra'}
          </li>
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-6">
          <div>
            <p className="text-sm text-white/70">Example per day</p>
            <p className="num mt-1 font-display text-2xl font-semibold text-[#c7c6ff]">{formatEthNumber(perDay)}</p>
          </div>
          <div>
            <p className="text-sm text-white/70">Over your {formatDuration(secs)} lock</p>
            <p className="num mt-1 font-display text-2xl font-semibold text-[#c7c6ff]">{formatEthNumber(perDay * days)}</p>
          </div>
        </div>
        <p className="num mt-4 text-sm text-white/70">Your share of the lockers’ pot: {formatPercent(share * 100, 2)}</p>
        {tooSmall && <p className="mt-2 text-sm text-[#ffd98a]">The smallest lock is 1 whole coin.</p>}
        <p className="mt-auto pt-6 text-xs leading-relaxed text-white/60">
          Example only, not a promise. It assumes a coin trading {BUSY[busy].ethPerDay} ETH a day through Clasp and
          other people locking 20% of the supply at an average 2× boost, and leaves out the coin’s Pons creator fees.
          Real earnings go up and down with trading, and are zero if nobody trades.
        </p>
      </div>
    </div>
  );
}
