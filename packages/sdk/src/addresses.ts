import { defineChain } from 'viem';

export const CHAIN_ID = 4663 as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
/** Early-exit penalties are sent here by every vault. */
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

/**
 * Robinhood Chain mainnet deployment. Pons v2 addresses are the live, verified contracts.
 */
export const addresses = {
  claspFactory: '0x82866AEAD0a590E5f9e7da74fC8c4FCAFFad60af',
  claspRouter: '0x2c2F23acbEd17827b7873Ce1Bc7430ADEB7Bf92A',
  claspLauncher: '0xE9E68B421dD2dE4F6825A9D5288D00732432A7af',

  ponsFactory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  ponsFeeEscrow: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
  ponsLaunchAndBuy: '0xe33E9E479dF8802cb0866d5d05258bEc4cF62948',
  ponsLaunchDeployer: '0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42',
  ponsMemeHook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044',
  ponsBuybackVault: '0x42df2a798f82289E177311362e8f5ccC45c1219c',
  /** 2-of-3 Safe that owns the Pons factory (can redirect creator fees after a 3-day timelock). */
  ponsOwner: '0x263ed295dAFaE1d9AAdD6E56c4B6F9f38eE019Dd',
  uniswapV4PoolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
} as const;

/** Block of the ClaspFactory deployment (indexer start). */
export const deployBlock = 72566517n;

export type ClaspAddresses = typeof addresses;

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});
