'use client';

import { claspFactoryAbi } from '@clasp/sdk';
import { useReadContracts } from 'wagmi';
import { claspContracts, robinhood } from './chain';
import { termsHash } from './terms';

/**
 * The rules and treasury a vault created right now would get. `hash` is the
 * value to pin in createVault / launch so the transaction reverts if Clasp's
 * owner changes the defaults between review and signing.
 */
export function useFactoryDefaults() {
  const factory = claspContracts.factory;
  const reads = useReadContracts({
    contracts: [
      { address: factory, abi: claspFactoryAbi, functionName: 'defaults', chainId: robinhood.id },
      { address: factory, abi: claspFactoryAbi, functionName: 'defaultsHash', chainId: robinhood.id },
      { address: factory, abi: claspFactoryAbi, functionName: 'treasury', chainId: robinhood.id },
    ],
  });
  const terms = reads.data?.[0]?.result;
  const hash = reads.data?.[1]?.result;
  const treasury = reads.data?.[2]?.result;
  // Only trust the hash when it matches the terms we are about to display.
  const consistent = !!terms && !!hash && termsHash(terms) === hash;
  return {
    terms: consistent ? terms : undefined,
    hash: consistent ? hash : undefined,
    treasury,
    isError: reads.isError || (!!terms && !!hash && !consistent),
    refetch: reads.refetch,
  };
}
