'use client';

import { useState } from 'react';
import { getAddress, isAddress, type Address, type Hash } from 'viem';
import { useBalance, usePublicClient, useSendTransaction } from 'wagmi';
import { robinhood } from '@/lib/chain';
import { humanError } from '@/lib/errors';
import { exportGoogleKey, GoogleWalletError, startGoogleLogin } from '@/lib/google-wallet';
import type { TxState } from '@/lib/tx';
import { AmountInput, parseAmount } from './AmountInput';
import { Modal } from './Modal';
import { TxStatus } from './TxStatus';
import { Button } from './ui';

const GAS_RESERVE = 200_000_000_000_000n; // 0.0002 ETH kept back by "Max" for the network fee

/** Sends ETH out of the Clasp-held Google wallet to any address. */
export function WithdrawDialog({ open, onClose, address }: { open: boolean; onClose: () => void; address: Address }) {
  const [to, setTo] = useState('');
  const [amountText, setAmountText] = useState('');
  const [state, setState] = useState<TxState>({ status: 'idle' });
  const eth = useBalance({ address, chainId: robinhood.id, query: { enabled: open, refetchInterval: 15_000 } });
  const publicClient = usePublicClient({ chainId: robinhood.id });
  const { sendTransactionAsync } = useSendTransaction();

  const amount = parseAmount(amountText);
  const recipient = isAddress(to.trim(), { strict: false }) ? getAddress(to.trim()) : null;
  const amountError =
    amountText && amount === null
      ? 'Enter an amount.'
      : amount !== null && eth.data && amount > eth.data.value
        ? 'That’s more than this wallet holds.'
        : null;
  const busy = state.status === 'signing' || state.status === 'confirming';

  async function withdraw() {
    if (!recipient || amount === null || !publicClient) return;
    let hash: Hash | undefined;
    try {
      setState({ status: 'signing' });
      hash = await sendTransactionAsync({ to: recipient, value: amount, chainId: robinhood.id });
      setState({ status: 'confirming', hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('The transfer failed on-chain. Only the network fee was spent.');
      setState({ status: 'success', hash });
      setAmountText('');
      await eth.refetch();
    } catch (error) {
      setState({ status: 'error', message: humanError(error), hash });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Withdraw ETH">
      <div className="space-y-4">
        <div>
          <label htmlFor="withdraw-to" className="label">
            Send to
          </label>
          <input
            id="withdraw-to"
            className={`field num ${to && !recipient ? 'border-bad' : ''}`}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {to && !recipient && <p className="mt-1.5 text-sm text-bad">That isn’t a valid address.</p>}
        </div>
        <AmountInput
          label="Amount"
          value={amountText}
          onChange={setAmountText}
          unit="ETH"
          balance={eth.data?.value}
          maxReserve={GAS_RESERVE}
          error={amountError}
        />
        <p className="hint">Only send to an address on Robinhood Chain. Transfers can’t be undone.</p>
        <Button className="w-full" disabled={!recipient || amount === null || !!amountError} busy={busy} onClick={withdraw}>
          Withdraw
        </Button>
        <TxStatus state={state} success="Sent!" />
      </div>
    </Modal>
  );
}

/** Reveals the private key of the Clasp-held Google wallet, so the owner can move it to any wallet. */
export function ExportKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [key, setKey] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function close() {
    setKey(null);
    setError(null);
    setNeedsLogin(false);
    onClose();
  }

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      setKey(await exportGoogleKey());
    } catch (e) {
      if (e instanceof GoogleWalletError && e.status === 403) setNeedsLogin(true);
      else setError(humanError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Export private key">
      <div className="space-y-4 text-sm">
        <p className="text-ink-2">
          Your private key controls this wallet. Import it into a wallet app such as MetaMask or Rabby to use your coins and
          ETH without Clasp.
        </p>
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-bad">
          Anyone who sees this key can take everything in the wallet. Never share it or paste it into a website.
        </p>
        {key ? (
          <>
            <p className="num rounded-xl border border-line bg-paper-2 p-3 break-all select-all">{key}</p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(key);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copied!' : 'Copy key'}
            </Button>
          </>
        ) : needsLogin ? (
          <>
            <p className="text-ink-2">For your safety, sign in with Google again, then export within 15 minutes.</p>
            <Button className="w-full" onClick={() => startGoogleLogin(window.location.pathname + window.location.search)}>
              Sign in with Google again
            </Button>
          </>
        ) : (
          <Button className="w-full" busy={loading} onClick={reveal}>
            Show my private key
          </Button>
        )}
        {error && <p className="text-bad">{error}</p>}
      </div>
    </Modal>
  );
}
