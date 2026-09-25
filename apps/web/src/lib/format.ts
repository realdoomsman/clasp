import { formatUnits } from 'viem';

const WEI = 10n ** 18n;

/** Converts a wei / base-unit decimal string (or bigint) to a JS number for display only. */
export function toNumber(value: string | bigint | null | undefined, decimals = 18): number {
  if (value === null || value === undefined || value === '') return 0;
  return Number(formatUnits(BigInt(value), decimals));
}

function trimNumber(n: number, maxFraction: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFraction }).format(n);
}

/** "0.0421 ETH" with precision that suits the size; tiny non-zero amounts show "<0.000001". */
export function formatEth(wei: string | bigint | null | undefined, opts: { unit?: boolean } = {}): string {
  const unit = opts.unit === false ? '' : ' ETH';
  if (wei === null || wei === undefined) return '—';
  const n = toNumber(wei);
  if (n === 0) return `0${unit}`;
  const abs = Math.abs(n);
  let text: string;
  if (abs < 0.000001) text = '<0.000001';
  else if (abs < 0.01) text = trimNumber(n, 6);
  else if (abs < 1) text = trimNumber(n, 4);
  else if (abs < 1000) text = trimNumber(n, 3);
  else text = compact(n);
  return `${text}${unit}`;
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

/** Token amount from base units, compact above a million ("12.4M"). */
export function formatTokens(amount: string | bigint | null | undefined, decimals = 18): string {
  const n = toNumber(amount, decimals);
  if (n === 0) return '0';
  if (Math.abs(n) >= 1_000_000) return compact(n);
  if (Math.abs(n) < 0.0001) return '<0.0001';
  return trimNumber(n, Math.abs(n) < 1 ? 4 : 2);
}

export function formatPercent(pct: number | null | undefined, digits = 1): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  if (pct > 0 && pct < 10 ** -digits) return `<${10 ** -digits}%`;
  if (pct >= 10_000) return `${compact(pct)}%`;
  return `${trimNumber(pct, digits)}%`;
}

export function formatMultiplier(bps: number | bigint): string {
  return `${trimNumber(Number(bps) / 10_000, 2)}×`;
}

/** Share of `total` that `part` represents, in percent (bigint-safe). */
export function sharePct(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((part * 1_000_000n) / total) / 10_000;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;

/** Plain-language duration: "4 hours", "1 week", "3 months", "1 year". */
export function formatDuration(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (s >= 365 * DAY) {
    const years = Math.round((s / (365 * DAY)) * 10) / 10;
    return plural(years, 'year');
  }
  if (s >= 30 * DAY) {
    const months = Math.round((s / (30.4167 * DAY)) * 10) / 10;
    return plural(months, 'month');
  }
  if (s >= 7 * DAY) {
    const weeks = Math.round((s / (7 * DAY)) * 10) / 10;
    return Number.isInteger(weeks) ? plural(weeks, 'week') : plural(Math.round(s / DAY), 'day');
  }
  if (s >= DAY) return plural(Math.round((s / DAY) * 10) / 10, 'day');
  if (s >= HOUR) return plural(Math.round((s / HOUR) * 10) / 10, 'hour');
  if (s >= MINUTE) return plural(Math.round(s / MINUTE), 'minute');
  return plural(s, 'second');
}

/** "in 3 days" / "2 hours ago" relative to now. */
export function formatRelative(unixSecs: number, nowSecs = Date.now() / 1000): string {
  const diff = unixSecs - nowSecs;
  const text = formatDuration(Math.abs(diff));
  if (Math.abs(diff) < 60) return 'just now';
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

export function formatDate(unixSecs: number, withTime = false): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(unixSecs * 1000));
}

/** ETH value of `amount` base units at `priceEth` wei per whole token. */
export function valueInEth(amount: string | bigint, priceEth: string | null): bigint | null {
  if (priceEth === null) return null;
  return (BigInt(amount) * BigInt(priceEth)) / WEI;
}
