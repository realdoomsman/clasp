import { ImageResponse } from 'next/og';

// Home-screen icon, rendered once at build time.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3d3bf3' }}>
        <svg width="128" height="128" viewBox="0 0 32 32">
          <path d="M7.5 26V13a6 6 0 0 1 12 0v4" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M24.5 6v13a6 6 0 0 1-12 0v-4" fill="none" stroke="#c7c6ff" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
