-- ─────────────────────────────────────────────────────────────────────────────
-- Dr Kofi InsightX — Supabase schema  (simplified hybrid architecture)
--
-- Run this entire file in your Supabase SQL Editor (one-shot).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
--
-- Architecture
-- ────────────────────────────────────────────────────────────────────────────
-- Mac (Playwright) ──writes──▶ scrape_results ──reads──▶ Vercel (dashboard)
--
-- • One row per date.  The Mac upserts a row each time it scrapes.
-- • Vercel reads the row for the requested date and returns it to the browser.
-- • No scrape_queue, no job polling — the Mac writes directly.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── scrape_results ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_results (
  date          TEXT        PRIMARY KEY,   -- e.g. "2026-05-25"
  fixtures      JSONB       NOT NULL DEFAULT '[]',
  method        TEXT        NOT NULL DEFAULT 'playwright',
  warnings      JSONB       NOT NULL DEFAULT '[]',
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fixture_count INTEGER     NOT NULL DEFAULT 0
);

-- Index for recency queries (ORDER BY scraped_at DESC)
CREATE INDEX IF NOT EXISTS scrape_results_scraped_at_idx ON scrape_results (scraped_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- anon key  (Vercel frontend / browser)  → SELECT only
-- service_role key (Mac scraper)         → all operations (bypasses RLS)

ALTER TABLE scrape_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scrape_results_select" ON scrape_results;
CREATE POLICY "scrape_results_select"
  ON scrape_results
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- Usage notes
-- ── odds_results ─────────────────────────────────────────────────────────────
-- Stores Flashscore 1X2 odds scraped by the Mac Playwright fetcher.
-- One row per date. Read by Vercel when the "Fetch from Flashscore" button is clicked.

CREATE TABLE IF NOT EXISTS odds_results (
  date          TEXT        PRIMARY KEY,
  fixtures      JSONB       NOT NULL DEFAULT '[]',
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fixture_count INTEGER     NOT NULL DEFAULT 0,
  warnings      JSONB       NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS odds_results_scraped_at_idx ON odds_results (scraped_at DESC);

ALTER TABLE odds_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "odds_results_select" ON odds_results;
CREATE POLICY "odds_results_select"
  ON odds_results FOR SELECT TO anon, authenticated USING (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Create a Supabase project at https://supabase.com
-- 2. Open SQL Editor and run this file
-- 3. Go to Project Settings → API and copy:
--      URL              → SUPABASE_URL
--      service_role key → SUPABASE_SERVICE_KEY   (Mac + Vercel backend)
--      anon key         → VITE_SUPABASE_ANON_KEY (optional — not used currently)
-- 4. Add SUPABASE_URL + SUPABASE_SERVICE_KEY to:
--      backend/.env          (Mac local dev)
--      Vercel → Project Settings → Environment Variables
-- 5. On your Mac: npm run scrape (from backend/ directory)
-- 6. On Vercel:  click "Fetch Forebet Games" — reads from Supabase
-- ─────────────────────────────────────────────────────────────────────────────
