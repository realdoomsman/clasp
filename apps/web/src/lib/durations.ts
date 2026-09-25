const HOUR = 3600;
const DAY = 86_400;

export const DURATION_PRESETS = [
  { label: '4h', long: '4 hours', secs: 4 * HOUR },
  { label: '1d', long: '1 day', secs: DAY },
  { label: '1w', long: '1 week', secs: 7 * DAY },
  { label: '1m', long: '1 month', secs: 30 * DAY },
  { label: '3m', long: '3 months', secs: 90 * DAY },
  { label: '6m', long: '6 months', secs: 180 * DAY },
  { label: '1y', long: '1 year', secs: 365 * DAY },
] as const;

export const SLIDER_STEPS = 1000;

/**
 * Slider position (0..SLIDER_STEPS) → seconds on a logarithmic scale, so the
 * short end (hours, days) gets as much room as the long end (months).
 * Rounded to whole hours under two days and whole days above.
 */
export function sliderToSecs(pos: number, min: number, max: number): number {
  if (pos <= 0) return min;
  if (pos >= SLIDER_STEPS) return max;
  const raw = min * Math.pow(max / min, pos / SLIDER_STEPS);
  const rounded = raw < 2 * DAY ? Math.round(raw / HOUR) * HOUR : Math.round(raw / DAY) * DAY;
  return Math.min(max, Math.max(min, rounded));
}

export function secsToSlider(secs: number, min: number, max: number): number {
  if (secs <= min) return 0;
  if (secs >= max) return SLIDER_STEPS;
  return Math.round((Math.log(secs / min) / Math.log(max / min)) * SLIDER_STEPS);
}
