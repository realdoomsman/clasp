'use client';

import { erc20Abi, type Address } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { robinhood } from './chain';

/** Token balance and the allowance `spender` has, for the connected wallet. */
export function useTokenAccess(token: Address, spender: Address | undefined) {
  const { address } = useAccount();
  const balance = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: robinhood.id,
    query: { enabled: !!address, refetchInterval: 20_000 },
  });
  const allowance = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && spender ? [address, spender] : undefined,
    chainId: robinhood.id,
    query: { enabled: !!address && !!spender },
  });
  return {
    balance: balance.data,
    allowance: allowance.data,
    refetch: () => Promise.all([balance.refetch(), allowance.refetch()]),
  };
}
