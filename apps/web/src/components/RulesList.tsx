import type { Terms } from '@clasp/sdk';
import { formatDuration, formatTokens } from '@/lib/format';
import { bpsToPercent } from '@/lib/terms';

/**
 * A vault's Terms in plain words. `symbol` is the coin's ticker when known; otherwise amounts
 * read "1 coin" / "5 coins". `extra` rows are appended (e.g. the coin's Pons creator fee).
 */
export function RulesList({ terms, symbol, extra = [] }: { terms: Terms; symbol?: string; extra?: [string, string][] }) {
  const lockers = Number(terms.lockerShareBps);
  const minAmount = formatTokens(BigInt(terms.minLockAmount));
  const unit = symbol || (minAmount === '1' ? 'coin' : 'coins');
  const rows: [string, string][] = [
    ['Lock length', `${formatDuration(Number(terms.minLockSecs))} to ${formatDuration(Number(terms.maxLockSecs))}`],
    ['Time boost', '1× for the shortest lock, rising to 4× for the longest'],
    [
      'Size boost',
      `+${bpsToPercent(terms.tier1BonusBps)} from ${bpsToPercent(terms.tier1ShareBps)} of supply, +${bpsToPercent(terms.tier2BonusBps)} from ${bpsToPercent(terms.tier2ShareBps)}, +${bpsToPercent(terms.tier3BonusBps)} from ${bpsToPercent(terms.tier3ShareBps)}`,
    ],
    [
      'Unlocking early',
      `Burns up to ${bpsToPercent(terms.penaltyBps)} of the locked coins, shrinking toward the end date, never under ${bpsToPercent(terms.minPenaltyBps)}. ETH not yet collected goes back to the other lockers; ETH already collected is always yours.`,
    ],
    ['Adding to a lock', `Needs at least ${formatDuration(Number(terms.minLockSecs))} left on it`],
    ['Fee split', `${bpsToPercent(lockers)} to lockers, ${bpsToPercent(10_000 - lockers)} to Clasp, 0% to the creator`],
    ['New fees are shared out over', formatDuration(Number(terms.streamSecs))],
    ['Smallest lock', `${minAmount} ${unit}`],
    ...extra,
  ];
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-sm font-semibold">{k}</dt>
          <dd className="num text-sm text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
