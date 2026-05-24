// ─────────────────────────────────────────────────────────────────────────────
// API client — communicates with the Express backend
//
// In development, Vite proxies /api → http://localhost:3001, so BASE stays '/api/forebet'.
// In production (Vercel), set VITE_API_URL to your backend Vercel deployment URL
// e.g. VITE_API_URL=https://kofi-insightx-api.vercel.app
// ─────────────────────────────────────────────────────────────────────────────

import type { FetchResult, Fixture } from '../types/Fixture';

const API_ROOT = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/forebet`
  : '/api/forebet';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchFixtures(
  date: string,
  refresh = false,
  penaliseWomens = false
): Promise<FetchResult> {
  const params = new URLSearchParams({
    date,
    refresh: String(refresh),
    penaliseWomens: String(penaliseWomens),
  });
  const res = await fetch(`${API_ROOT}?${params}`);
  return handleResponse<FetchResult>(res);
}

export async function submitManualPaste(
  text: string,
  date: string,
  penaliseWomens = false
): Promise<FetchResult> {
  const res = await fetch(`${API_ROOT}/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, date, penaliseWomens }),
  });
  return handleResponse<FetchResult>(res);
}

export async function deepVerify(fixtures: Fixture[]): Promise<{
  results: Array<{
    id: string;
    updatedReason: string;
    updatedConfidence: number;
    trendData: Record<string, string | undefined>;
  }>;
}> {
  const res = await fetch(`${API_ROOT}/deep-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fixtures }),
  });
  return handleResponse(res);
}

export async function clearCache(date: string): Promise<{ cleared: boolean }> {
  const res = await fetch(`${API_ROOT}/cache?date=${date}`, { method: 'DELETE' });
  return handleResponse(res);
}

export async function checkHealth(): Promise<{ status: string }> {
  const healthUrl = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/health`
    : '/api/health';
  const res = await fetch(healthUrl);
  return handleResponse(res);
}
