'use client';

import { addresses, claspFactoryAbi, claspVaultAbi, ponsFactoryAbi, ZERO_ADDRESS, type Terms } from '@clasp/sdk';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { erc20Abi, getAddress, isAddress, isAddressEqual, type Address } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { RulesList } from '@/components/RulesList';
import { TxStatus } from '@/components/TxStatus';
import { Button, Card, Notice, Spinner } from '@/components/ui';
import { WalletGate } from '@/components/WalletGate';
import { claspContracts, explorerAddress, robinhood } from '@/lib/chain';
import { useFactoryDefaults } from '@/lib/factory-terms';
import { shortAddress } from '@/lib/format';
import { termsHash } from '@/lib/terms';
import { useTx } from '@/lib/tx';

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${ok ? 'bg-good' : 'bg-bad'}`}
      >
        {ok ? '✓' : '✕'}
      </span>
      <span>
        <span className="sr-only">{ok ? 'Yes: ' : 'No: '}</span>
        {children}
      </span>
    </li>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-line p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-good text-white' : 'bg-accent-soft text-accent-strong'}`}
        >
          {done ? '✓' : n}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="mt-3 text-sm text-ink-2">{children}</div>
    </li>
  );
}

function Rules({ title, terms, treasury, symbol }: { title: string; terms: Terms; treasury: Address; symbol?: string }) {
  return (
    <div className="mt-3 rounded-2xl bg-paper-2/70 p-3 sm:p-4">
      <p className="font-semibold text-ink">{title}</p>
      <RulesList terms={terms} symbol={symbol} extra={[['Clasp’s 10% goes to', shortAddress(treasury)]]} />
      <a href={explorerAddress(treasury)} target="_blank" rel="noreferrer" className="hint underline">
        Check the treasury address on the explorer ↗
      </a>
    </div>
  );
}

function JoinSteps({ token }: { token: Address }) {
  const { address } = useAccount();
  const factory = claspContracts.factory;
  const defaults = useFactoryDefaults();
  const create = useTx();
  const transfer = useTx();

  const reads = useReadContracts({
    contracts: [
      { address: addresses.ponsFactory, abi: ponsFactoryAbi, functionName: 'getLaunchedToken', args: [token], chainId: robinhood.id },
      { address: factory, abi: claspFactoryAbi, functionName: 'vaultOf', args: [token], chainId: robinhood.id },
      { address: token, abi: erc20Abi, functionName: 'symbol', chainId: robinhood.id },
    ],
    query: { refetchInterval: 15_000 },
  });
  const launch = reads.data?.[0]?.result;
  const vaultOf = reads.data?.[1]?.result;
  const symbol = reads.data?.[2]?.result;
  const vault = vaultOf && vaultOf !== ZERO_ADDRESS ? vaultOf : undefined;
  const vaultReads = useReadContracts({
    contracts: [
      { address: vault ?? ZERO_ADDRESS, abi: claspVaultAbi, functionName: 'isFeeRecipient', chainId: robinhood.id },
      { address: vault ?? ZERO_ADDRESS, abi: claspVaultAbi, functionName: 'terms', chainId: robinhood.id },
      { address: vault ?? ZERO_ADDRESS, abi: claspVaultAbi, functionName: 'treasury', chainId: robinhood.id },
    ],
    query: { enabled: !!vault, refetchInterval: 15_000 },
  });
  const isRecipient = vaultReads.data?.[0]?.result;
  const vaultTerms = vaultReads.data?.[1]?.result;
  const vaultTreasury = vaultReads.data?.[2]?.result;

  if (reads.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <Spinner /> Looking up the coin on Pons…
      </p>
    );
  }
  if (!launch || !launch.exists) {
    return <Notice tone="bad">That address isn’t a coin launched on Pons v2. Check you pasted the coin’s address, not a wallet.</Notice>;
  }

  const ethPaired = launch.pairToken === ZERO_ADDRESS;
  const noBuyback = !launch.buybackEnabled;
  const eligible = ethPaired && noBuyback;
  const recipient = launch.creatorFeeRecipient;
  const done = !!vault && isRecipient === true;
  const youAreRecipient = !!address && isAddressEqual(address, recipient);
  // Only hand the fees over to a vault whose rules and treasury are exactly Clasp's current ones shown here.
  const vaultChecked = !!vaultTerms && !!vaultTreasury && !!defaults.hash && !!defaults.treasury;
  const vaultMatches =
    !!vaultTerms && !!vaultTreasury && !!defaults.treasury && termsHash(vaultTerms) === defaults.hash && isAddressEqual(vaultTreasury, defaults.treasury);

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        <Check ok>Launched on Pons v2</Check>
        <Check ok={ethPaired}>Traded against ETH{!ethPaired && ' — Clasp only supports ETH-paired coins'}</Check>
        <Check ok={noBuyback}>Pons buybacks switched off{!noBuyback && ' — buybacks pay in the coin itself, which a vault can’t share out'}</Check>
      </ul>

      {!eligible ? (
        <Notice tone="warn">This coin can’t join Clasp.</Notice>
      ) : done ? (
        <Notice tone="good" title="All set!">
          This coin’s creator fees go to its Clasp vault. <Link href={`/coins/${token}`}>Open its page</Link> to lock and trade.
        </Notice>
      ) : (
        <ol className="space-y-3">
          <Step n={1} title="Create the coin’s vault" done={!!vault}>
            {vault ? (
              <p>
                Vault created at{' '}
                <a href={explorerAddress(vault)} target="_blank" rel="noreferrer" className="num underline">
                  {shortAddress(vault)}
                </a>
                .
              </p>
            ) : (
              <>
                <p>Anyone can do this. It costs only the network fee.</p>
                {defaults.terms && defaults.treasury ? (
                  <Rules title="The vault will be created with these rules, for good" terms={defaults.terms} treasury={defaults.treasury} symbol={symbol} />
                ) : (
                  <p className="mt-2 flex items-center gap-2"><Spinner /> Reading Clasp’s current rules…</p>
                )}
                <div className="mt-3">
                  <WalletGate action="create the vault" className="w-full sm:w-auto">
                    <Button
                      disabled={!defaults.hash}
                      busy={create.busy}
                      onClick={async () => {
                        if (!defaults.hash) return;
                        // Pinned: reverts with TermsMismatch if Clasp's defaults change before this confirms.
                        const r = await create.send({ address: factory, abi: claspFactoryAbi, functionName: 'createVault', args: [token, defaults.hash] });
                        if (!r) await defaults.refetch();
                        await reads.refetch();
                      }}
                    >
                      Create vault
                    </Button>
                    <TxStatus state={create.state} success="Vault created." />
                  </WalletGate>
                </div>
              </>
            )}
          </Step>
          <Step n={2} title="Point creator fees at the vault" done={false}>
            <p>
              Only the coin’s current creator-fee recipient,{' '}
              <a href={explorerAddress(recipient)} target="_blank" rel="noreferrer" className="num underline">
                {shortAddress(recipient)}
              </a>
              , can do this on Pons.
            </p>
            <p className="mt-2">
              <strong className="text-ink">This is permanent from your side:</strong> the vault can’t hand the fees back.
              Only Pons’s admin could redirect them later, after a 3-day public wait.
            </p>
            {vault && vaultTerms && vaultTreasury && (
              <Rules title="This vault’s rules (they can never change)" terms={vaultTerms} treasury={vaultTreasury} symbol={symbol} />
            )}
            {vault && vaultChecked && !vaultMatches && (
              <Notice tone="bad" className="mt-3">
                This vault’s rules or treasury don’t match Clasp’s current ones, so this page won’t offer the switch. Compare
                them carefully before doing anything elsewhere.
              </Notice>
            )}
            <div className="mt-3">
              <WalletGate action="continue" className="w-full sm:w-auto">
                {!youAreRecipient ? (
                  <p className="text-ink-3">
                    Your connected wallet isn’t the fee recipient. Open this page with {shortAddress(recipient)} to finish, or send
                    this page to whoever controls it.
                  </p>
                ) : !vault ? (
                  <Button disabled>Create the vault first</Button>
                ) : !vaultChecked ? (
                  <p className="flex items-center gap-2 text-ink-3">
                    <Spinner /> Checking the vault’s rules…
                  </p>
                ) : vaultMatches ? (
                  <>
                    <Button
                      busy={transfer.busy}
                      onClick={async () => {
                        await transfer.send({
                          address: addresses.ponsFactory,
                          abi: ponsFactoryAbi,
                          functionName: 'transferCreatorFeeRecipient',
                          args: [token, vault],
                        });
                        await vaultReads.refetch();
                      }}
                    >
                      Send creator fees to the vault
                    </Button>
                    <TxStatus state={transfer.state} success="Done! Creator fees now go to this coin’s lockers." />
                  </>
                ) : null}
              </WalletGate>
            </div>
          </Step>
        </ol>
      )}
    </div>
  );
}

export function JoinForm() {
  const id = useId();
  // The coin page links here as /launch?token=0x…#join for the coin's fee recipient.
  const initialToken = useSearchParams().get('token') ?? '';
  const [text, setText] = useState(initialToken);
  const token = isAddress(text.trim()) ? getAddress(text.trim()) : null;
  return (
    <Card className="p-5 sm:p-7">
      <label htmlFor={id} className="label">
        Your coin’s address
      </label>
      <input
        id={id}
        className="field num"
        placeholder="0x…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {text && !token && <p className="mt-1.5 text-sm text-bad">That doesn’t look like an address. It starts with 0x and has 42 characters.</p>}
      {token && (
        <div className="mt-5">
          <JoinSteps token={token} />
        </div>
      )}
    </Card>
  );
}
