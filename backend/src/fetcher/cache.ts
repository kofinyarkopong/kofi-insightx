// ─────────────────────────────────────────────────────────────────────────────
// Cache — file-based locally, in-memory on Vercel (read-only filesystem)
//
// On Vercel serverless the filesystem is read-only, so we fall back to a
// simple Map-based in-memory cache.  The in-memory cache survives for the
// lifetime of the serverless function instance (typically a few minutes),
// which is still enough to deduplicate rapid duplicate requests.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import type { Fixture } from '../types/Fixture';

export interface CacheEntry {
  date: string;
  fetchedAt: string;
  fixtures: Fixture[];
  warnings: string[];
  method: string;
}

// ── In-memory fallback (used on Vercel) ───────────────────────────────────────
const memCache = new Map<string, CacheEntry>();

// Vercel sets this env var automatically in all deployed functions
const IS_VERCEL = !!process.env.VERCEL;

// ── File-based cache (used locally) ──────────────────────────────────────────
const CACHE_DIR = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : path.join(process.cwd(), 'cache');

function ensureCacheDir(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch {
    // Swallow — will fall back to in-memory if the dir can't be created
  }
}

function cacheFilePath(date: string): string {
  return path.join(CACHE_DIR, `forebet-${date}.json`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function readCache(date: string): CacheEntry | null {
  if (IS_VERCEL) {
    return memCache.get(date) ?? null;
  }
  ensureCacheDir();
  const fp = cacheFilePath(date);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as CacheEntry;
  } catch {
    return null;
  }
}

export function writeCache(date: string, entry: CacheEntry): void {
  if (IS_VERCEL) {
    memCache.set(date, entry);
    return;
  }
  ensureCacheDir();
  try {
    fs.writeFileSync(cacheFilePath(date), JSON.stringify(entry, null, 2), 'utf-8');
  } catch (err) {
    // Fall back to in-memory if file write fails (e.g. read-only FS)
    console.warn('[Cache] File write failed, using in-memory cache:', (err as Error).message);
    memCache.set(date, entry);
  }
}

export function clearCache(date: string): void {
  memCache.delete(date);
  if (!IS_VERCEL) {
    const fp = cacheFilePath(date);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* ignore */ }
  }
}

export function listCachedDates(): string[] {
  if (IS_VERCEL) return Array.from(memCache.keys());
  ensureCacheDir();
  try {
    return fs
      .readdirSync(CACHE_DIR)
      .filter(f => f.startsWith('forebet-') && f.endsWith('.json'))
      .map(f => f.replace('forebet-', '').replace('.json', ''));
  } catch {
    return [];
  }
}
