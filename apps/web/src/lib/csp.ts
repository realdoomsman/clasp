import { API_URL, RPC_URL } from './env';

// Wallets are browser extensions (or in-app wallet browsers) that talk to the page
// through window.ethereum / EIP-6963 events, so no third-party origin is needed:
// the page only calls the Clasp API and the Robinhood Chain RPC.

function origin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Builds the Content-Security-Policy for one response. Scripts are allowed
 * only through the per-request nonce (Next.js stamps it on its own scripts)
 * plus 'strict-dynamic' for the chunks those scripts load.
 */
export function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  const api = origin(API_URL);
  const rpc = origin(RPC_URL);
  const connect = ["'self'", api, rpc].filter(Boolean);
  if (dev) connect.push('ws:');

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    // Next.js and React inject some inline styles.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Coin logos live on the API image host or any https host a creator used.
    'img-src': ["'self'", 'data:', 'blob:', 'https:', ...(api && api.startsWith('http:') ? [api] : [])],
    'font-src': ["'self'"],
    'connect-src': connect as string[],
    'frame-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!dev && api?.startsWith('https:')) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}
