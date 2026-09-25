function Arrow() {
  return (
    <div className="flex items-center justify-center text-line-2" aria-hidden="true">
      <svg viewBox="0 0 48 24" className="h-6 w-12 rotate-90 lg:rotate-0">
        <path d="M2 12h40m-8-8 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** "Where the money comes from": trades + Pons creator fees → vault → 90% lockers / 10% Clasp. */
export function MoneyFlow() {
  return (
    <figure aria-labelledby="money-flow-caption">
      <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_0.9fr_auto_1fr]">
        <div className="grid gap-3">
          <div className="card p-5">
            <p className="text-sm font-semibold text-accent-strong">2% of every trade</p>
            <p className="mt-1 text-ink-2">
              When anyone buys or sells the coin on Clasp, 2% of the ETH in the trade goes to the coin’s vault.
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-accent-strong">The coin’s Pons creator fees</p>
            <p className="mt-1 text-ink-2">
              The coin’s creator fees from the Pons launchpad are pointed at the vault too, so they flow in as well.
            </p>
          </div>
        </div>
        <Arrow />
        <div className="rounded-[var(--radius-card)] bg-ink p-6 text-center text-white shadow-[var(--shadow-lift)]">
          <svg viewBox="0 0 32 32" className="mx-auto h-10 w-10" aria-hidden="true">
            <path d="M7.5 26V13a6 6 0 0 1 12 0v4" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M24.5 6v13a6 6 0 0 1-12 0v-4" fill="none" stroke="#a9a8ff" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <p className="mt-3 font-display text-xl font-semibold">The coin’s vault</p>
          <p className="mt-1 text-sm text-white/75">One per coin. Holds the ETH and the locked coins. Nobody can take them out except by its fixed rules.</p>
        </div>
        <Arrow />
        <div className="grid gap-3">
          <div className="card border-accent/30 bg-accent-tint p-5">
            <p className="num font-display text-3xl font-semibold text-accent-strong">90%</p>
            <p className="mt-1 font-semibold">To the people who lock</p>
            <p className="mt-1 text-sm text-ink-2">Split by how much each person locked and for how long. Paid in ETH, collect anytime.</p>
          </div>
          <div className="card p-5">
            <p className="num font-display text-2xl font-semibold">10%</p>
            <p className="mt-1 font-semibold">To Clasp</p>
            <p className="mt-1 text-sm text-ink-2">Keeps the lights on. The coin’s creator takes 0%.</p>
          </div>
        </div>
      </div>
      <figcaption id="money-flow-caption" className="sr-only">
        Two sources pay into each coin’s vault: 2% of every trade made on Clasp, and the coin’s Pons creator fees. The
        vault sends 90% to the coin’s lockers and 10% to Clasp.
      </figcaption>
    </figure>
  );
}
