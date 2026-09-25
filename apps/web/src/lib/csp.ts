import { API_URL, RPC_URL } from './env';

// Origins Privy documents as required for @privy-io/react-auth:
// https://docs.privy.io/security/implementation-guide/content-security-policy
// WalletConnect entries are widened to the walletconnect.{com,org} subdomains
// because the bundled WalletConnect provider also talks to pulse./rpc.
// subdomains that the Privy page does not list yet.
const PRIVY_FRAMES = [
  'https://auth.privy.io',
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
];
const CAPTCHA = 'https://challenges.cloudflare.com';
const PRIVY_CONNECT = [
  'https://auth.privy.io',
  'https://*.rpc.privy.systems',
  'https://explorer-api.walletconnect.com',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'wss://relay.walletconnect.com',
  'wss://relay.walletconnect.org',
  'wss://*.walletconnect.com',
  'wss://*.walletconnect.org',
  'wss://www.walletlink.org',
];

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
  const connect = ["'self'", api, rpc, ...PRIVY_CONNECT].filter(Boolean);
  if (dev) connect.push('ws:');

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      CAPTCHA,
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // Privy's modal injects runtime styles, so inline styles must be allowed.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Coin logos live on the API image host or any https host a creator used.
    'img-src': ["'self'", 'data:', 'blob:', 'https:', ...(api && api.startsWith('http:') ? [api] : [])],
    'font-src': ["'self'"],
    'connect-src': connect as string[],
    'frame-src': [...PRIVY_FRAMES, CAPTCHA],
    'child-src': PRIVY_FRAMES,
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
