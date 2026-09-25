'use client';

import { addresses, claspLauncherAbi, DEFAULT_TERMS, durationBps, ponsFactoryAbi, ZERO_ADDRESS } from '@clasp/sdk';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { bytesToHex, parseEventLogs, type Address } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { AmountInput, parseAmount } from '@/components/AmountInput';
import { DurationPicker } from '@/components/DurationPicker';
import { RulesList } from '@/components/RulesList';
import { TxStatus } from '@/components/TxStatus';
import { Button, Card, Notice, Spinner } from '@/components/ui';
import { WalletGate } from '@/components/WalletGate';
import { uploadImage } from '@/lib/api';
import { claspContracts, explorerAddress, robinhood } from '@/lib/chain';
import { useFactoryDefaults } from '@/lib/factory-terms';
import { formatEth, formatMultiplier, formatTokens, shortAddress } from '@/lib/format';
import { useTx } from '@/lib/tx';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const SOCIALS = [
  { key: 'website', label: 'Website', placeholder: 'https://yourcoin.xyz' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/yourcoin' },
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/yourcoin' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/…' },
  { key: 'farcaster', label: 'Farcaster', placeholder: 'https://farcaster.xyz/yourcoin' },
] as const;
type SocialKey = (typeof SOCIALS)[number]['key'];

const randomSalt = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));

function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="hint mt-1.5">{hint}</p>}
    </div>
  );
}

function ImagePicker({ url, onUrl }: { url: string; onUrl: (url: string) => void }) {
  const id = useId();
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setState({ busy: false, error: 'Use a PNG, JPG, GIF or WebP image.' });
    if (file.size > MAX_IMAGE_BYTES) return setState({ busy: false, error: 'The image must be 2 MB or smaller.' });
    setState({ busy: true, error: null });
    try {
      onUrl(await uploadImage(file));
      setState({ busy: false, error: null });
    } catch (e) {
      setState({ busy: false, error: `Upload failed: ${e instanceof Error ? e.message : 'unknown error'}` });
    }
  }

  return (
    <div>
      <span className="label">Logo</span>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-line-2 bg-paper-2">
          {state.busy ? (
            <Spinner className="h-6 w-6 text-ink-3" />
          ) : url ? (
            // Plain <img>: the uploaded logo lives on the API's image host.
            <img src={url} alt="Your coin’s logo" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-ink-3">No logo</span>
          )}
        </div>
        <div>
          <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-line-2 bg-card px-3.5 text-sm font-semibold hover:border-ink-3 focus-within:outline-3 focus-within:outline-accent">
            {url ? 'Change image' : 'Upload image'}
            <input id={id} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p className="hint mt-1.5">PNG, JPG, GIF or WebP, up to 2 MB. Square works best.</p>
        </div>
      </div>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function LaunchForm() {
  const ids = { name: useId(), symbol: useId(), description: useId(), tax: useId(), lockPct: useId() };
  const launcher = claspContracts.launcher;
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [logo, setLogo] = useState('');
  const [description, setDescription] = useState('');
  const [socials, setSocials] = useState<Record<SocialKey, string>>({ website: '', twitter: '', telegram: '', discord: '', farcaster: '' });
  const [taxPct, setTaxPct] = useState('1');
  const [devBuyText, setDevBuyText] = useState('0.1');
  const [lockPct, setLockPct] = useState(50);
  const [lockSecs, setLockSecs] = useState(DEFAULT_TERMS.maxLockSecs);
  const [salt, setSalt] = useState(randomSalt);
  const [launched, setLaunched] = useState<{ token: Address; locked: bigint } | null>(null);
  const tx = useTx();
  const defaults = useFactoryDefaults();
  const rules = defaults.terms ?? DEFAULT_TERMS;

  const pons = useReadContracts({
    contracts: [
      { address: addresses.ponsFactory, abi: ponsFactoryAbi, functionName: 'launchFee', chainId: robinhood.id },
      { address: addresses.ponsFactory, abi: ponsFactoryAbi, functionName: 'maxCreatorTaxBps', chainId: robinhood.id },
      { address: addresses.ponsFactory, abi: ponsFactoryAbi, functionName: 'getLaunchConfig', args: [0n], chainId: robinhood.id },
      { address: addresses.ponsFactory, abi: ponsFactoryAbi, functionName: 'launchEnabled', chainId: robinhood.id },
    ],
  });
  const economics = useReadContract({
    address: addresses.ponsFactory,
    abi: ponsFactoryAbi,
    functionName: 'previewLaunchEconomics',
    args: [0n, ZERO_ADDRESS],
    chainId: robinhood.id,
  });
  const launchFee = pons.data?.[0]?.result;
  const maxTaxBps = Number(pons.data?.[1]?.result ?? 1000n);
  const config = pons.data?.[2]?.result;
  const launchEnabled = pons.data?.[3]?.result;

  const devBuy = devBuyText.trim() === '' || Number(devBuyText) === 0 ? 0n : parseAmount(devBuyText);
  const taxBps = Math.round(Number(taxPct) * 100);
  const effectiveLockPct = devBuy ? lockPct : 0;

  // First buy on a fresh curve: tokensOut = net × supply / (phantomQuote + net).
  const net = devBuy && config ? (devBuy * BigInt(10_000 - Number(config.curveFeeBps) - taxBps)) / 10_000n : 0n;
  const estTokens = config && net > 0n ? (net * config.supply) / (config.phantomQuote + net) : 0n;
  const estLocked = (estTokens * BigInt(effectiveLockPct)) / 100n;

  const errors: Partial<Record<'name' | 'symbol' | 'tax' | 'devBuy' | 'socials', string>> = {};
  if (name.trim().length === 0) errors.name = 'Give your coin a name.';
  else if (name.trim().length > 32) errors.name = 'Keep the name to 32 characters or fewer.';
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) errors.symbol = 'Use 2–10 capital letters or digits, like CLSP.';
  if (!Number.isFinite(taxBps) || taxBps < 0 || taxBps > maxTaxBps) errors.tax = `Pick between 0% and ${maxTaxBps / 100}%.`;
  if (devBuy === null) errors.devBuy = 'Enter an ETH amount, like 0.1, or 0 to skip.';
  if (Object.values(socials).some((v) => v && !/^https:\/\/\S+$/.test(v))) errors.socials = 'Links must start with https://';
  const valid = Object.keys(errors).length === 0 && !!logo;

  async function onLaunch() {
    if (!valid || devBuy === null || launchFee === undefined || !economics.data || !defaults.hash || !defaults.treasury) return;
    const receipt = await tx.send({
      address: launcher,
      abi: claspLauncherAbi,
      functionName: 'launch',
      value: launchFee + devBuy,
      args: [
        {
          name: name.trim(),
          symbol,
          logo,
          description: description.trim(),
          socials,
          creatorTaxBps: taxBps,
          salt,
          expectedEconomics: economics.data,
          launchConfigId: 0n,
          devBuyEth: devBuy,
          // The dev buy is the first trade on a curve created in the same transaction: nothing can front-run it.
          minTokensOut: 0n,
          lockPercent: effectiveLockPct,
          lockSecs: effectiveLockPct > 0 ? lockSecs : 0,
          // Pin the vault rules and treasury shown on this page; the launch reverts if either changed.
          expectedTermsHash: defaults.hash,
          expectedTreasury: defaults.treasury,
        },
      ],
    });
    if (!receipt) {
      // A TermsMismatch / TreasuryMismatch revert means Clasp's defaults moved: show the new ones.
      await defaults.refetch();
      return;
    }
    const [event] = parseEventLogs({ abi: claspLauncherAbi, eventName: 'Launched', logs: receipt.logs });
    if (event) setLaunched({ token: event.args.token, locked: event.args.lockedAmount });
    setSalt(randomSalt());
  }

  if (launched) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <p className="font-display text-2xl font-semibold">{name} is live!</p>
        <p className="mt-2 text-ink-2">
          {launched.locked > 0n ? `${formatTokens(launched.locked)} ${symbol} are locked for you and already earning. ` : ''}
          Share the page so people can buy and lock.
        </p>
        <Link href={`/coins/${launched.token}`} className="mt-5 inline-flex h-11 items-center rounded-2xl bg-accent px-5 font-semibold text-white hover:bg-accent-strong">
          Go to {symbol}’s page
        </Link>
        <p className="hint mt-3">It can take a minute for the coin to appear in listings.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-7">
      {launchEnabled === false && (
        <Notice tone="warn" className="mb-6">
          Pons has paused new launches right now. Try again later.
        </Notice>
      )}
      <div className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
          <Field label="Name" htmlFor={ids.name}>
            <input id={ids.name} className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Clasp Cat" />
            {name && errors.name && <p className="mt-1.5 text-sm text-bad">{errors.name}</p>}
          </Field>
          <Field label="Ticker" htmlFor={ids.symbol}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3">$</span>
              <input
                id={ids.symbol}
                className="field pl-7 uppercase"
                value={symbol}
                maxLength={10}
                onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="CCAT"
              />
            </div>
            {symbol && errors.symbol && <p className="mt-1.5 text-sm text-bad">{errors.symbol}</p>}
          </Field>
        </div>

        <ImagePicker url={logo} onUrl={setLogo} />

        <Field label="Description" htmlFor={ids.description} hint={`${description.length}/500`}>
          <textarea
            id={ids.description}
            className="field min-h-24"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What’s the story? Keep it short and fun."
          />
        </Field>

        <fieldset>
          <legend className="label">Links (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIALS.map((s) => (
              <label key={s.key} className="block">
                <span className="sr-only">{s.label}</span>
                <input
                  className="field"
                  type="url"
                  inputMode="url"
                  placeholder={`${s.label}: ${s.placeholder}`}
                  value={socials[s.key]}
                  onChange={(e) => setSocials({ ...socials, [s.key]: e.target.value.trim() })}
                />
              </label>
            ))}
          </div>
          {errors.socials && <p className="mt-1.5 text-sm text-bad">{errors.socials}</p>}
        </fieldset>

        <Field
          label="Creator fee on every Pons trade"
          htmlFor={ids.tax}
          hint={
            <>
              Charged by Pons on each trade of your coin and paid <strong>to the vault</strong>, so 90% of it goes to lockers.
              You don’t get it personally — lock your own coins to earn your share. Max {maxTaxBps / 100}%.
            </>
          }
        >
          <div className="relative w-40">
            <input id={ids.tax} inputMode="decimal" className="field num pr-8" value={taxPct} onChange={(e) => setTaxPct(e.target.value.replace(/[^\d.]/g, ''))} />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-3">%</span>
          </div>
          {errors.tax && <p className="mt-1.5 text-sm text-bad">{errors.tax}</p>}
        </Field>

        <div className="rounded-2xl border border-line p-4 sm:p-5">
          <AmountInput label="Your first buy" value={devBuyText} onChange={setDevBuyText} unit="ETH" error={errors.devBuy} />
          <p className="hint mt-1.5">
            You buy first, in the same transaction, before anyone else can. {estTokens > 0n && <>That’s about {formatTokens(estTokens)} {symbol || 'coins'}.</>}
          </p>

          {devBuy ? (
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor={ids.lockPct} className="label">
                    Lock part of it right away
                  </label>
                  <span className="num font-semibold">{lockPct}%</span>
                </div>
                <input
                  id={ids.lockPct}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={lockPct}
                  onChange={(e) => setLockPct(Number(e.target.value))}
                  className="range"
                  style={{ ['--fill' as string]: `${lockPct}%` }}
                  aria-valuetext={`${lockPct}%`}
                />
                <p className="hint">
                  {lockPct > 0
                    ? `About ${formatTokens(estLocked)} ${symbol || 'coins'} locked for you, the rest sent to your wallet. Locking shows buyers you’re in it for the long run.`
                    : 'Everything goes to your wallet. You can lock later.'}
                </p>
              </div>
              {lockPct > 0 && (
                <div>
                  <DurationPicker value={lockSecs} onChange={setLockSecs} min={rules.minLockSecs} max={rules.maxLockSecs} />
                  <p className="num hint mt-1">
                    Time boost {formatMultiplier(durationBps(lockSecs, rules.minLockSecs, rules.maxLockSecs))}, plus a size
                    boost if it’s a big share of the supply.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line p-4 sm:p-5">
          <h3 className="font-semibold">Your coin’s vault will get these rules</h3>
          <p className="hint mt-1">
            {defaults.terms
              ? 'Read from Clasp’s factory just now and written into the vault for good. If Clasp changes its defaults before your launch confirms, the launch is cancelled instead of using different rules.'
              : 'Reading the current rules from Clasp’s factory…'}
          </p>
          <div className="mt-3">
            <RulesList
              terms={rules}
              symbol={symbol || undefined}
              extra={defaults.treasury ? [['Clasp’s 10% goes to', shortAddress(defaults.treasury)]] : []}
            />
          </div>
          {defaults.treasury && (
            <a href={explorerAddress(defaults.treasury)} target="_blank" rel="noreferrer" className="hint mt-1 inline-block underline">
              Check the treasury address on the explorer ↗
            </a>
          )}
          {defaults.isError && <p className="mt-2 text-sm text-bad">Couldn’t read Clasp’s current rules. Refresh the page to try again.</p>}
        </div>

        <dl className="rounded-2xl bg-paper-2 p-4 text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-ink-2">Pons launch fee</dt>
            <dd className="num font-semibold">{launchFee !== undefined ? formatEth(launchFee) : '…'}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ink-2">Your first buy</dt>
            <dd className="num font-semibold">{formatEth(devBuy ?? 0n)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-line-2 pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className="num font-display text-lg font-semibold">
              {launchFee !== undefined && devBuy !== null ? formatEth(launchFee + devBuy) : '…'}
            </dd>
          </div>
          <p className="mt-2 text-xs text-ink-3">Plus a small network fee. Your first buy doesn’t pay Clasp’s 2% trading fee.</p>
        </dl>

        <WalletGate action="launch">
          <Button
            size="lg"
            className="w-full"
            disabled={!valid || launchEnabled === false || !economics.data || !defaults.hash || !defaults.treasury}
            busy={tx.busy}
            onClick={onLaunch}
          >
            {!logo && name ? 'Add a logo to continue' : `Launch ${symbol ? `$${symbol}` : 'your coin'}`}
          </Button>
          <TxStatus state={tx.state} />
        </WalletGate>
        <p className="text-xs text-ink-3">
          Launching creates the coin on Pons with its creator fees pointed at its Clasp vault and Pons buybacks switched off.
         
        </p>
      </div>
    </Card>
  );
}
