'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  EstimateContractGasParameters,
  Hash,
  SimulateContractParameters,
  TransactionReceipt,
} from 'viem';
import { useAccount, useConfig, usePublicClient } from 'wagmi';
import { getWalletClient, switchChain } from 'wagmi/actions';
import { robinhood } from './chain';
import { humanError } from './errors';

type Mutability = 'nonpayable' | 'payable';

export type ContractCall<
  abi extends Abi = Abi,
  fn extends ContractFunctionName<abi, Mutability> = ContractFunctionName<abi, Mutability>,
> = {
  address: Address;
  abi: abi;
  functionName: fn;
  args: ContractFunctionArgs<abi, Mutability, fn>;
  value?: bigint;
};

export type TxState =
  | { status: 'idle' }
  | { status: 'switching' | 'checking' | 'signing' }
  | { status: 'confirming'; hash: Hash }
  | { status: 'success'; hash: Hash }
  | { status: 'error'; message: string; hash?: Hash };

/**
 * Sends one contract call the safe way: switch to Robinhood Chain if needed,
 * simulate first (so a call that would fail never reaches the wallet), sign,
 * then wait for the receipt and refresh every query on the page.
 */
export function useTx() {
  const config = useConfig();
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: robinhood.id });
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ status: 'idle' });

  const send = useCallback(
    async <const abi extends Abi, fn extends ContractFunctionName<abi, Mutability>>(
      call: ContractCall<abi, fn>,
    ): Promise<TransactionReceipt | null> => {
      if (!address || !publicClient) {
        setState({ status: 'error', message: 'Log in first.' });
        return null;
      }
      let hash: Hash | undefined;
      try {
        if (chainId !== robinhood.id) {
          setState({ status: 'switching' });
          await switchChain(config, { chainId: robinhood.id });
        }
        setState({ status: 'checking' });
        // viem's generic inference can't follow `call` through this wrapper; the
        // public signature above already checks function name and args against the ABI.
        const params = { ...call, account: address, chain: robinhood };
        const { request } = await publicClient.simulateContract(params as unknown as SimulateContractParameters);
        // Vault calls release the reward stream up to the block time, so the gas used at
        // inclusion can exceed the estimate; 1.5× headroom (unused gas is not charged).
        const estimate = await publicClient.estimateContractGas(params as unknown as EstimateContractGasParameters);
        setState({ status: 'signing' });
        const wallet = await getWalletClient(config, { chainId: robinhood.id, account: address });
        hash = await wallet.writeContract({ ...(request as Parameters<typeof wallet.writeContract>[0]), gas: (estimate * 3n) / 2n });
        setState({ status: 'confirming', hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          throw new Error('The transaction failed on-chain. Only the network fee was spent.');
        }
        setState({ status: 'success', hash });
        await queryClient.invalidateQueries();
        return receipt;
      } catch (error) {
        setState({ status: 'error', message: humanError(error), hash });
        return null;
      }
    },
    [address, chainId, config, publicClient, queryClient],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  const busy = state.status === 'switching' || state.status === 'checking' || state.status === 'signing' || state.status === 'confirming';
  return { send, state, reset, busy };
}

export const TX_LABELS: Record<Exclude<TxState['status'], 'idle' | 'error' | 'success'>, string> = {
  switching: 'Switching to Robinhood Chain…',
  checking: 'Checking it will work…',
  signing: 'Confirm in your wallet…',
  confirming: 'Waiting for the network…',
};
