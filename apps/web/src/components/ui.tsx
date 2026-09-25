'use client';

import Link from 'next/link';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-strong shadow-[0_6px_16px_-8px_rgb(61_59_243/0.7)] disabled:bg-line-2 disabled:text-ink-3 disabled:shadow-none',
  secondary: 'bg-card text-ink border border-line-2 hover:border-ink-3 disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-paper-2 hover:text-ink disabled:text-ink-3',
  danger: 'bg-bad text-white hover:bg-[#921c13] disabled:bg-line-2 disabled:text-ink-3',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-11 px-5 text-[0.9375rem] rounded-2xl',
  lg: 'h-13 px-6 text-base rounded-2xl',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  busy = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      className={buttonClass(variant, size, className)}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-paper-2 text-ink-2',
    accent: 'bg-accent-soft text-accent-strong',
    good: 'bg-good-soft text-good',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-paper-2 ${className}`} />;
}

export function Notice({
  tone = 'warn',
  title,
  children,
  className = '',
}: {
  tone?: 'warn' | 'bad' | 'info' | 'good';
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    warn: 'bg-warn-soft border-warn-line text-warn',
    bad: 'bg-bad-soft border-[#f5c2bd] text-bad',
    info: 'bg-accent-tint border-accent-soft text-accent-strong',
    good: 'bg-good-soft border-[#bfe3cd] text-good',
  };
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]} ${className}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={`${title ? 'mt-1' : ''} text-ink-2 [&_a]:underline [&_strong]:text-ink`}>{children}</div>
    </div>
  );
}

export function ErrorState({ error, onRetry, what = 'this' }: { error: unknown; onRetry?: () => void; what?: string }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Card className="p-6 text-center">
      <p className="font-display text-lg font-semibold">We couldn’t load {what}.</p>
      <p className="mt-1 text-sm text-ink-3">
        Clasp’s data service didn’t answer ({message}). Your coins and earnings are safe on-chain.
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-3">{children}</div>}
    </Card>
  );
}

/** Coin logo with a friendly fallback when there is no image or it fails to load. */
export function TokenAvatar({
  src,
  symbol,
  size = 40,
}: {
  src: string | null | undefined;
  symbol: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    const hue = [...symbol].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    return (
      <span
        aria-hidden="true"
        style={{ ...style, background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 55% 30%)`, fontSize: size * 0.36 }}
        className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold"
      >
        {symbol.slice(0, 2).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    // Plain <img>: logos live on arbitrary creator hosts that next/image would have to proxy.
    <img
      src={src}
      alt=""
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-paper-2 object-cover"
    />
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 animate-rise sm:mb-10">
      {eyebrow && <p className="mb-2 text-sm font-semibold tracking-wide text-accent-strong uppercase">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-base text-ink-2 sm:text-lg">{children}</div>}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-ink-3">{label}</p>
      <p className="num mt-0.5 font-display text-xl font-semibold sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-2xl bg-paper-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
            value === o.value ? 'bg-card text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
