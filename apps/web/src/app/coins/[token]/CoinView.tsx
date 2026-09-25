'use client';

import { claspVaultAbi } from '@clasp/sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { Address } from 'viem';
import { TxStatus } from '@/components/TxStatus';
import { Badge, ButtonLink, Button, Card, EmptyState, ErrorState, Skeleton, Stat, TokenAvatar } from '@/components/ui';
import { ApiError, api, type CoinDetail } from '@/lib/api';
import { explorerAddress } from '@/lib/chain';
import { formatEth, formatPercent, formatTokens, sharePct, shortAddress } from '@/lib/format';
import { termsFromApi } from '@/lib/terms';
import { useTx } from '@/lib/tx';
import { CoinBanners } from './CoinBanners';
import { CoinTables } from './CoinTables';
import { LockPanel } from './LockPanel';
import { TermsCard } from './TermsCard';
import { TradePanel } from './TradePanel';

function Socials({ coin }: { coin: CoinDetail }) {
  const links = [
    ['Website', coin.website],
    ['X', coin.twitter],
    ['Telegram', coin.telegram],
    ['Discord', coin.discord],
    ['Farcaster', coin.farcaster],
  ].filter((l): l is [string, string] => !!l[1] && /^https:\/\//.test(l[1]));
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map(([label, href]) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer nofollow"
            className="inline-flex rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            {label} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}

function Harvest({ coin }: { coin: CoinDetail }) {
  const tx = useTx();
  // What the page last pulled in. The data service can lag a block or two behind, so keep the
  // button hidden while it still reports that same amount waiting; nobody pays gas twice.
  const [pulled, setPulled] = useState<bigint | null>(null);
  const waiting = BigInt(coin.vaultState.escrowBalance) + BigInt(coin.vaultState.curveFees);
  if (tx.state.status === 'success' && (pulled === null || waiting <= pulled)) {
    return (
      <p role="status" className="rounded-2xl bg-good-soft px-4 py-3 text-sm text-good">
        Pulled in. It’s shared out to lockers over the next hour.
      </p>
    );
  }
  if (waiting === 0n) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-tint px-4 py-3 text-sm">
      <p className="text-ink-2">
        <strong className="num text-ink">{formatEth(waiting)}</strong> of creator fees is waiting at Pons. Clasp’s bot pulls it
        in regularly, or anyone can do it now.
      </p>
      <div>
        <Button
          size="sm"
          variant="secondary"
          busy={tx.busy}
          onClick={async () => {
            const amount = waiting;
            if (await tx.send({ address: coin.vault, abi: claspVaultAbi, functionName: 'harvest', args: [] })) setPulled(amount);
          }}
        >
          Pull it in
        </Button>
        <TxStatus state={tx.state} />
      </div>
    </div>
  );
}

function CoinBody({ coin }: { coin: CoinDetail }) {
  const terms = useMemo(() => termsFromApi(coin.terms), [coin.terms]);
  const [copied, setCopied] = useState(false);
  const lockedPct = sharePct(BigInt(coin.totalLocked), BigInt(coin.totalSupply));
  const price = coin.priceEth === null ? null : BigInt(coin.priceEth);
  // Under 0.0001 ETH a coin, quote the price per million coins so it stays readable.
  const tinyPrice = price !== null && price < 10n ** 14n;

  return (
    <div className="space-y-8">
      <header className="animate-rise">
        <div className="flex flex-wrap items-center gap-4">
          <TokenAvatar src={coin.image} symbol={coin.symbol} size={72} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold break-words sm:text-4xl">{coin.name}</h1>
              <Badge tone={coin.graduated ? 'neutral' : 'accent'}>{coin.graduated ? 'Trading on Uniswap' : 'On the Pons curve'}</Badge>
            </div>
            <p className="num mt-1 text-ink-3">
              ${coin.symbol} ·{' '}
              <button
                type="button"
                className="hover:text-ink"
                onClick={async () => {
                  await navigator.clipboard.writeText(coin.token);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                aria-label="Copy coin address"
              >
                {copied ? 'Copied!' : shortAddress(coin.token)}
              </button>{' '}
              · made by{' '}
              <a href={explorerAddress(coin.creator)} target="_blank" rel="noreferrer" className="hover:text-ink">
                {shortAddress(coin.creator)}
              </a>
            </p>
          </div>
        </div>
        {coin.description && <p className="mt-4 max-w-3xl whitespace-pre-line text-ink-2">{coin.description}</p>}
        <div className="mt-4">
          <Socials coin={coin} />
        </div>
      </header>

      <CoinBanners coin={coin} />

      <Card className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-6">
        <Stat
          label="Price"
          value={price === null ? '—' : formatEth(tinyPrice ? price * 1_000_000n : price)}
          hint={`per ${tinyPrice ? '1M ' : ''}${coin.symbol}`}
        />
        <Stat label="Market cap" value={formatEth(coin.marketCapEth)} />
        <Stat label="Yearly rate" value={<span className="text-accent-strong">{formatPercent(coin.apr)}</span>} hint="from the last 7 days" />
        <Stat label="Supply locked" value={formatPercent(lockedPct)} hint={`${formatTokens(coin.totalLocked)} ${coin.symbol}`} />
        <Stat label="Lockers" value={coin.lockers} />
        <Stat label="Paid to lockers" value={formatEth(coin.paidToLockers)} hint={`${formatEth(coin.toLockers7dEth)} this week`} />
      </Card>

      <Harvest coin={coin} />

      <div className="grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <LockPanel coin={coin} terms={terms} />
        <TradePanel coin={coin} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
        <TermsCard coin={coin} terms={terms} />
        <CoinTables coin={coin} />
      </div>
    </div>
  );
}

export function CoinView({ token }: { token: Address }) {
  const query = useQuery({ queryKey: ['coin', token], queryFn: () => api.coin(token), refetchInterval: 20_000 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {query.isPending ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-20 w-72" />
          <Skeleton className="h-28" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState title="This coin doesn’t have a Clasp vault">
            <p>
              <span className="num">{shortAddress(token)}</span> isn’t on Clasp yet. If it’s a Pons coin, it can join.
            </p>
            <ButtonLink href="/launch#join" size="sm" className="mt-4">
              Add a Pons coin to Clasp
            </ButtonLink>
          </EmptyState>
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} what="this coin" />
        )
      ) : (
        <CoinBody coin={query.data} />
      )}
    </div>
  );
}
