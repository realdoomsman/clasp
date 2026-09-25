import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { NetworkGuard } from '@/components/NetworkGuard';
import { Providers } from '@/components/Providers';
import { SITE_URL } from '@/lib/env';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

// Every page is rendered per request so the CSP nonce set in middleware.ts
// can be stamped on Next.js's scripts.
export const dynamic = 'force-dynamic';

const description =
  'Lock a coin you believe in and earn a share of every trade, paid in ETH. Clasp vaults for Pons coins on Robinhood Chain.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Clasp — Lock a coin you believe in. Earn a share of every trade.', template: '%s · Clasp' },
  description,
  applicationName: 'Clasp',
  openGraph: {
    type: 'website',
    siteName: 'Clasp',
    title: 'Clasp — Lock a coin you believe in. Earn a share of every trade.',
    description,
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#fbf8f3',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg"
        >
          Skip to content
        </a>
        <Providers>
          <Header />
          <NetworkGuard />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
