import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

// Rendered once at build time into a static PNG.
export const alt = 'Clasp — Lock a coin you believe in. Earn a share of every trade.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  // `next build` runs in apps/web, where @fontsource/outfit is a dev dependency.
  const fontDir = path.join(process.cwd(), 'node_modules/@fontsource/outfit/files');
  const [semibold, regular] = await Promise.all([
    readFile(path.join(fontDir, 'outfit-latin-600-normal.woff')),
    readFile(path.join(fontDir, 'outfit-latin-400-normal.woff')),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#fbf8f3',
          fontFamily: 'Outfit',
          color: '#16151a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <path d="M7.5 26V13a6 6 0 0 1 12 0v4" fill="none" stroke="#16151a" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M24.5 6v13a6 6 0 0 1-12 0v-4" fill="none" stroke="#3d3bf3" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1 }}>Clasp</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 72, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>Lock a coin you believe in.</span>
            <span style={{ color: '#3d3bf3' }}>Earn a share of every trade.</span>
          </div>
          <span style={{ fontSize: 32, color: '#45424d' }}>
            Trading fees paid in ETH to the people who lock. On Robinhood Chain.
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Outfit', data: semibold, weight: 600, style: 'normal' },
        { name: 'Outfit', data: regular, weight: 400, style: 'normal' },
      ],
    },
  );
}
