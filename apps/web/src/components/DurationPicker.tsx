'use client';

import { useId } from 'react';
import { DURATION_PRESETS, SLIDER_STEPS, secsToSlider, sliderToSecs } from '@/lib/durations';
import { formatDate, formatDuration } from '@/lib/format';

/** Preset chips plus a log-scale slider for picking a lock length in seconds. */
export function DurationPicker({
  value,
  onChange,
  min,
  max,
  label = 'Lock for',
  minEnd,
}: {
  value: number;
  onChange: (secs: number) => void;
  min: number;
  max: number;
  label?: string;
  /** hide presets that would end before this unix time (used by "extend") */
  minEnd?: number;
}) {
  const id = useId();
  const pos = secsToSlider(value, min, max);
  const now = Math.floor(Date.now() / 1000);
  const presets = DURATION_PRESETS.filter((p) => p.secs >= min && p.secs <= max);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label mb-0">
          {label}
        </label>
        <p className="num text-sm text-ink-2" aria-live="polite">
          <strong className="font-semibold text-ink">{formatDuration(value)}</strong>
          <span className="text-ink-3"> · ends {formatDate(now + value)}</span>
        </p>
      </div>
      <div role="group" aria-label="Quick picks" className="mt-3 flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const tooShort = minEnd !== undefined && now + p.secs <= minEnd;
          return (
            <button
              key={p.label}
              type="button"
              disabled={tooShort}
              aria-pressed={value === p.secs}
              aria-label={p.long}
              onClick={() => onChange(p.secs)}
              className={`num h-9 min-w-11 rounded-xl px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                value === p.secs ? 'bg-accent text-white' : 'bg-paper-2 text-ink-2 hover:bg-accent-soft hover:text-accent-strong'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={pos}
        onChange={(e) => onChange(sliderToSecs(Number(e.target.value), min, max))}
        aria-valuetext={formatDuration(value)}
        className="range mt-3"
        style={{ ['--fill' as string]: `${(pos / SLIDER_STEPS) * 100}%` }}
      />
      <div className="flex justify-between text-xs text-ink-3" aria-hidden="true">
        <span>{formatDuration(min)}</span>
        <span>{formatDuration(max)}</span>
      </div>
    </div>
  );
}
