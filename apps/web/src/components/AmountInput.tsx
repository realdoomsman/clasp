'use client';

import { useId } from 'react';
import { formatUnits, parseUnits } from 'viem';

/** Parses what a person typed into base units; null when it isn't a valid positive amount. */
export function parseAmount(text: string, decimals = 18): bigint | null {
  const clean = text.replace(/,/g, '').trim();
  if (!/^\d*\.?\d*$/.test(clean) || clean === '' || clean === '.') return null;
  const [, fraction = ''] = clean.split('.');
  if (fraction.length > decimals) return null;
  const value = parseUnits(clean, decimals);
  return value > 0n ? value : null;
}

export function AmountInput({
  label,
  value,
  onChange,
  unit,
  balance,
  decimals = 18,
  maxReserve = 0n,
  error,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  unit: string;
  /** base units; shows a "Max" button when provided */
  balance?: bigint;
  decimals?: number;
  /** held back from "Max" (e.g. ETH for network fees) */
  maxReserve?: bigint;
  error?: string | null;
}) {
  const id = useId();
  const max = balance !== undefined && balance > maxReserve ? balance - maxReserve : 0n;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {balance !== undefined && (
          <p className="num text-xs text-ink-3">
            You have {Number(formatUnits(balance, decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 })} {unit}
          </p>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          className={`field num pr-28 text-lg ${error ? 'border-bad focus:border-bad' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5">
          {balance !== undefined && (
            <button
              type="button"
              onClick={() => onChange(formatUnits(max, decimals))}
              disabled={max === 0n}
              className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-bold text-accent-strong hover:bg-accent hover:text-white disabled:opacity-40"
            >
              Max
            </button>
          )}
          <span className="max-w-16 truncate pr-2 text-sm font-semibold text-ink-3">{unit}</span>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
