'use client';

import { addresses, claspRouterAbi, ponsCurveAbi, ponsFactoryAbi } from '@clasp/sdk';
import { useDeferredValue, useId, useState } from 'react';
import { erc20Abi, zeroAddress } from 'viem';
import { useAccount, useBalance, useReadContract, useReadContracts } from 'wagmi';
import { AmountInput, parseAmount } from '@/components/AmountInput';
import { TxStatus } from '@/components/TxStatus';
import { Button, Card, Notice, Segmented } from '@/components/ui';
import { WalletGate } from '@/components/WalletGate';
import { useTokenAccess } from '@/lib/allowance';
import type { CoinDetail } from '@/lib/api';
import { claspContracts, robinhood } from '@/lib/chain';
import { formatEth, formatTokens } from '@/lib/format';
import { bpsToPercent } from '@/lib/terms';
import { useTx } from '@/lib/tx';

type Side = 'buy' | 'sell';
const SLIPPAGE_PRESETS = [50, 100, 300];
const GAS_RESERVE = 200_000_000_000_000n; // 0.0002 ETH kept back by "Max" for network fees
const DEADLINE_SECS = 20 * 60;

function Row({ label, value, strong = false }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={`num text-right ${strong ? 'font-display text-lg font-semibold' : 'text-sm font-semibold'}`}>{value}</dd>
    </div>
  );
}

export function TradePanel({ coin }: { coin: CoinDetail }) {
  const router = claspContracts.router;
  const slipId = useId();
  const [side, setSide] = useState<Side>('buy');
  const [text, setText] = useState('');
  const [slippageBps, setSlippageBps] = useState(100);
  const [customSlip, setCustomSlip] = useState('');
  const { address } = useAccount();
  const eth = useBalance({ address, chainId: robinhood.id, query: { enabled: !!address, refetchInterval: 20_000 } });
  const { balance: tokenBalance, allowance, refetch } = useTokenAccess(coin.token, router);
  const approve = useTx();
  const trade = useTx();

  const deferredText = useDeferredValue(text);
  const amount = parseAmount(deferredText);
  const quote = useReadContract({
    address: router,
    abi: claspRouterAbi,
    functionName: side === 'buy' ? 'quoteBuy' : 'quoteSell',
    args: amount ? [coin.token, amount] : undefined,
    chainId: robinhood.id,
    query: { enabled: amount !== null, refetchInterval: 10_000 },
  });
  const [out, fee] = quote.data ?? [undefined, undefined];
  const minOut = out !== undefined ? (out * BigInt(10_000 - slippageBps)) / 10_000n : undefined;

  // Pons taxes buys heavily for a few seconds after launch ("snipe tax", up to 99%), and the
  // router's quote ignores it. Check the curve for both the trader and the router, and block buys.
  const launched = useReadContract({
    address: addresses.ponsFactory,
    abi: ponsFactoryAbi,
    functionName: 'getLaunchedToken',
    args: [coin.token],
    chainId: robinhood.id,
    query: { enabled: !coin.graduated },
  });
  const curve = launched.data?.curve;
  const snipe = useReadContracts({
    contracts: [address ?? router, router].map((who) => ({
      address: curve ?? zeroAddress,
      abi: ponsCurveAbi,
      functionName: 'currentSnipeTaxBps' as const,
      args: [who] as const,
      chainId: robinhood.id,
    })),
    query: { enabled: !coin.graduated && !!curve && curve !== zeroAddress, refetchInterval: 2_000 },
  });
  const launchProtection = (snipe.data ?? []).some((r) => typeof r.result === 'bigint' && r.result > 0n);

  const balance = side === 'buy' ? eth.data?.value : tokenBalance;
  let error: string | null = null;
  if (text && parseAmount(text) === null) error = 'Enter a number, like 0.05.';
  else if (amount !== null && balance !== undefined && amount > balance)
    error = side === 'buy' ? 'That’s more ETH than you have.' : `You only have ${formatTokens(balance)} ${coin.symbol}.`;

  const needsApproval = side === 'sell' && amount !== null && (allowance ?? 0n) < amount;
  // The quote is keyed by the (deferred) amount, so a defined minOut always matches what is typed.
  const ready = amount !== null && text === deferredText && !error && minOut !== undefined && !(side === 'buy' && launchProtection);
  const payUnit = side === 'buy' ? 'ETH' : coin.symbol;
  const getUnit = side === 'buy' ? coin.symbol : 'ETH';
  const fmtOut = (v: bigint) => (side === 'buy' ? `${formatTokens(v)} ${coin.symbol}` : formatEth(v));

  function switchSide(next: Side) {
    setSide(next);
    setText('');
    trade.reset();
    approve.reset();
  }

  async function onApprove() {
    if (!amount) return;
    const receipt = await approve.send({ address: coin.token, abi: erc20Abi, functionName: 'approve', args: [router, amount] });
    if (receipt) await refetch();
  }

  async function onTrade() {
    if (!amount || minOut === undefined) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECS);
    const receipt =
      side === 'buy'
        ? await trade.send({ address: router, abi: claspRouterAbi, functionName: 'buy', args: [coin.token, minOut, deadline], value: amount })
        : await trade.send({ address: router, abi: claspRouterAbi, functionName: 'sell', args: [coin.token, amount, minOut, deadline] });
    if (receipt) {
      setText('');
      approve.reset();
      await Promise.all([refetch(), eth.refetch()]);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trade</h2>
        <Segmented
          label="Buy or sell"
          value={side}
          onChange={switchSide}
          options={[
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
          ]}
        />
      </div>
      <p className="mt-1 text-sm text-ink-2">
        Trades here pay a 2% fee to this coin’s vault — 90% of it goes to the people locking {coin.symbol}.
      </p>

      <div className="mt-5">
        <AmountInput
          label={side === 'buy' ? 'You pay' : 'You sell'}
          value={text}
          onChange={setText}
          unit={payUnit}
          balance={balance}
          maxReserve={side === 'buy' ? GAS_RESERVE : 0n}
          error={error}
        />
      </div>

      <div className="mt-4">
        <p className="label" id={slipId}>
          Price protection (slippage)
        </p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby={slipId}>
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps}
              type="button"
              aria-pressed={slippageBps === bps && !customSlip}
              onClick={() => {
                setSlippageBps(bps);
                setCustomSlip('');
              }}
              className={`num h-9 rounded-xl px-3 text-sm font-semibold ${
                slippageBps === bps && !customSlip ? 'bg-accent text-white' : 'bg-paper-2 text-ink-2 hover:bg-accent-soft'
              }`}
            >
              {bpsToPercent(bps)}
            </button>
          ))}
          <label className="relative">
            <span className="sr-only">Custom slippage in percent</span>
            <input
              inputMode="decimal"
              placeholder="Custom"
              value={customSlip}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, '');
                setCustomSlip(v);
                const pct = Number(v);
                if (v && pct > 0 && pct <= 50) setSlippageBps(Math.round(pct * 100));
              }}
              className="field num h-9 w-24 py-1 pr-7 text-sm"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-3">%</span>
          </label>
        </div>
        <p className="hint mt-1.5">
          If the price moves against you by more than {bpsToPercent(slippageBps)} before your trade lands, it’s cancelled
          and you keep your {payUnit}.
        </p>
        {slippageBps > 500 && <p className="mt-1 text-sm text-warn">High slippage: you could get noticeably less than shown.</p>}
      </div>

      <dl className="mt-5 divide-y divide-line rounded-2xl border border-line px-4 py-2" aria-live="polite">
        <Row
          label="Clasp fee (2%)"
          value={fee !== undefined ? formatEth(fee) : '—'}
        />
        <Row label={`You get about`} value={out !== undefined ? fmtOut(out) : quote.isFetching ? 'Checking…' : '—'} strong />
        <Row label={`At least, after ${bpsToPercent(slippageBps)} slippage`} value={minOut !== undefined ? fmtOut(minOut) : '—'} />
      </dl>
      <p className="hint mt-2">
        The estimate already includes Pons’s own trading fee
        {coin.creatorTaxBps > 0 ? ` and the coin’s ${bpsToPercent(coin.creatorTaxBps)} creator fee (which also goes to lockers)` : ''}.
        {quote.isError && <span className="block text-bad">Couldn’t get a price right now. Try a different amount.</span>}
      </p>

      {side === 'buy' && launchProtection && (
        <Notice tone="warn" className="mt-5">
          Launch protection is active for a few more seconds (trades are heavily taxed). Buying opens right after.
        </Notice>
      )}
      <div className="mt-5">
        <WalletGate action={side}>
          {needsApproval && approve.state.status !== 'success' ? (
            <>
              <Button size="lg" className="w-full" onClick={onApprove} disabled={!!error} busy={approve.busy}>
                Step 1 of 2: Allow Clasp to sell {formatTokens(amount)} {coin.symbol}
              </Button>
              <TxStatus state={approve.state} />
            </>
          ) : (
            <>
              <Button size="lg" className="w-full" onClick={onTrade} disabled={!ready || needsApproval} busy={trade.busy}>
                {side === 'buy' ? `Buy ${coin.symbol}` : `Sell ${coin.symbol} for ${getUnit}`}
              </Button>
              <TxStatus state={trade.state} success={side === 'buy' ? 'Bought! Lock it to start earning.' : 'Sold!'} />
            </>
          )}
        </WalletGate>
      </div>
    </Card>
  );
}
