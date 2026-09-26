'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Re-runs the server lookup every few seconds until the coin is indexed and the page redirects. */
export function RefreshSoon({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
