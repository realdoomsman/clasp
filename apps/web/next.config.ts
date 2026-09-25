import path from 'node:path';
import type { NextConfig } from 'next';

// Static security headers for every response. The Content-Security-Policy is
// set per request in src/middleware.ts (built by src/lib/csp.ts) because a
// strict policy needs a fresh script nonce on every page view, which a static
// header here cannot carry.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Google and Coinbase sign-in open popups that must be able to talk back.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // pnpm workspace: trace dependencies from the repository root (`next build` runs in apps/web).
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@clasp/sdk'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  webpack(config, { isServer }) {
    // wagmi's connector bundle pulls in @base-org/account, whose Node entry imports
    // Coinbase's server-side payments SDK (and its uninstalled x402 peers). None of
    // it runs during server rendering, so resolve it to an empty module there.
    if (isServer) config.resolve.alias = { ...config.resolve.alias, '@coinbase/cdp-sdk': false };
    return config;
  },
};

export default nextConfig;
