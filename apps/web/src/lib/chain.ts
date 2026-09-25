import { addresses } from '@clasp/sdk';
import { defineChain } from 'viem';
import { EXPLORER_URL, RPC_URL } from './env';

export const claspContracts = {
  factory: addresses.claspFactory,
  router: addresses.claspRouter,
  launcher: addresses.claspLauncher,
};

export const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: EXPLORER_URL } },
});

export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
