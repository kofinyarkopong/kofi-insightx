// ─────────────────────────────────────────────────────────────────────────────
// Supabase client — optional bridge between Mac scraper and Vercel frontend.
//
// On Vercel:   SUPABASE_URL + SUPABASE_SERVICE_KEY must be set in env vars.
//              The client is used to READ scrape_results written by the Mac.
//
// On Mac local dev:  These vars are optional.  If set, every successful scrape
//              also upserts to Supabase so Vercel sees fresh data automatically.
//              If not set, local mode works exactly as before (file cache only).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type SupabaseClientOrNull = SupabaseClient | null;

/**
 * Returns a Supabase client when SUPABASE_URL and SUPABASE_SERVICE_KEY are
 * present in env, otherwise returns null so callers can skip Supabase logic
 * gracefully.
 */
function buildClient(): SupabaseClientOrNull {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const supabase: SupabaseClientOrNull = buildClient();

// ── Row shape for scrape_results table ────────────────────────────────────────
export interface ScrapeResultRow {
  date:          string;          // primary key e.g. "2026-05-25"
  fixtures:      unknown[];       // JSON array of Fixture objects
  method:        string;          // "playwright" | "cheerio" | "manual"
  warnings:      string[];        // parse / fetch warnings
  scraped_at:    string;          // ISO timestamp
  fixture_count: number;
}
