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
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
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
};

export default nextConfig;
