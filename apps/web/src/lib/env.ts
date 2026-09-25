// Public configuration. Every value here is inlined into the browser bundle at
// build time, so nothing secret may ever be read in this file.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.clasp.fun').replace(/\/+$/, '');
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://clasp.fun').replace(/\/+$/, '');
export const EXPLORER_URL = 'https://robinhoodchain.blockscout.com';
