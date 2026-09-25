import Link from 'next/link';

/** The Clasp mark: two rounded hooks caught in each other. */
export function LogoMark({ className = 'h-8 w-8', mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path
        d="M7.5 26V13a6 6 0 0 1 12 0v4"
        fill="none"
        stroke={mono ? 'currentColor' : 'var(--color-ink)'}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M24.5 6v13a6 6 0 0 1-12 0v-4"
        fill="none"
        stroke={mono ? 'currentColor' : 'var(--color-accent)'}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-lg" aria-label="Clasp home">
      <LogoMark />
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Clasp</span>
    </Link>
  );
}
