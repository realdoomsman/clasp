import type {
  ActivityResponse,
  CoinDetail,
  CoinsResponse,
  ImageUploadResponse,
  LeaderboardResponse,
  LockersResponse,
  StatsResponse,
  WalletResponse,
} from './api-types';
import { API_URL } from './env';

export type * from './api-types';

export type CoinSort = 'new' | 'earning' | 'locked' | 'lockers';
export type Board = LeaderboardResponse['board'];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readError(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new ApiError(body?.error ?? fallback, res.status);
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  if (!res.ok) throw await readError(res, `Request failed (${res.status})`);
  return (await res.json()) as T;
}

export const api = {
  stats: () => apiGet<StatsResponse>('/api/stats'),
  coins: (sort: CoinSort, search: string, limit = 60) => {
    const q = new URLSearchParams({ sort, limit: String(limit) });
    if (search.trim()) q.set('search', search.trim());
    return apiGet<CoinsResponse>(`/api/coins?${q}`);
  },
  coin: (token: string) => apiGet<CoinDetail>(`/api/coins/${token}`),
  lockers: (token: string) => apiGet<LockersResponse>(`/api/coins/${token}/lockers`),
  activity: (token: string) => apiGet<ActivityResponse>(`/api/coins/${token}/activity`),
  wallet: (address: string) => apiGet<WalletResponse>(`/api/wallet/${address}`),
  leaderboard: <B extends Board>(board: B) =>
    apiGet<Extract<LeaderboardResponse, { board: B }>>(`/api/leaderboard?board=${board}`),
};

/** Uploads a coin logo; returns the absolute URL that goes into the on-chain logo field. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/images`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await readError(res, `Upload failed (${res.status})`);
  return ((await res.json()) as ImageUploadResponse).url;
}
