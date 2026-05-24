-- ─────────────────────────────────────────────────────────────────────────────
-- Dr Kofi InsightX — Supabase schema
-- Run this entire file in the Supabase SQL Editor (one-shot).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── matches ───────────────────────────────────────────────────────────────────
-- One row per fixture per date.  Written by the Mac scraper; read by the
-- Vercel dashboard.

CREATE TABLE IF NOT EXISTS matches (
  id                TEXT        PRIMARY KEY,   -- hash: date+homeTeam+awayTeam
  date              DATE        NOT NULL,
  kickoff_time      TEXT,
  home_team         TEXT        NOT NULL,
  away_team         TEXT        NOT NULL,
  league            TEXT,
  href              TEXT,                       -- /en/football/matches/…

  -- probabilities (0-100)
  home_win_prob     SMALLINT,
  draw_prob         SMALLINT,
  away_win_prob     SMALLINT,

  -- forebet predictions
  predicted_score   TEXT,
  avg_goals         NUMERIC(4,2),
  prediction        TEXT,
  odds              TEXT,

  -- scoring engine output
  confidence_score  NUMERIC(5,2),
  confidence_tier   TEXT CHECK (confidence_tier IN ('strong','watch','lean','reject')),
  score_breakdown   JSONB,
  risk_flags        JSONB,

  -- filter flags
  filter_a          BOOLEAN     DEFAULT FALSE,
  filter_b          BOOLEAN     DEFAULT FALSE,
  best_shortlist    BOOLEAN     DEFAULT FALSE,
  needs_review      BOOLEAN     DEFAULT FALSE,

  -- enrichment
  enriched          BOOLEAN     DEFAULT FALSE,
  enrichment_data   JSONB,

  -- metadata
  source            TEXT        DEFAULT 'playwright',  -- 'playwright' | 'manual'
  scraped_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index for the most common query pattern
CREATE INDEX IF NOT EXISTS matches_date_idx ON matches (date DESC);
CREATE INDEX IF NOT EXISTS matches_filter_idx ON matches (date, filter_a, filter_b, best_shortlist);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_updated_at ON matches;
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── scrape_queue ──────────────────────────────────────────────────────────────
-- The dashboard writes a pending row here; job-watcher.js on the Mac picks
-- it up, runs the pipeline, and updates status to completed or failed.

CREATE TABLE IF NOT EXISTS scrape_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT        DEFAULT 'pending'
                              CHECK (status IN ('pending','running','completed','failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  fixtures_found  INTEGER,
  fixtures_saved  INTEGER,
  progress        TEXT,
  triggered_by    TEXT        DEFAULT 'dashboard'
);

CREATE INDEX IF NOT EXISTS scrape_queue_status_idx ON scrape_queue (status, created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The anon key (used by the Vercel frontend) can:
--   matches      → SELECT only
--   scrape_queue → SELECT + INSERT (to trigger a job)
--
-- The service_role key (used by the Mac scraper) bypasses RLS entirely.

ALTER TABLE matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_queue ENABLE ROW LEVEL SECURITY;

-- matches: public read
DROP POLICY IF EXISTS "matches_select" ON matches;
CREATE POLICY "matches_select"
  ON matches FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- scrape_queue: public read
DROP POLICY IF EXISTS "scrape_queue_select" ON scrape_queue;
CREATE POLICY "scrape_queue_select"
  ON scrape_queue FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- scrape_queue: dashboard can insert new jobs
DROP POLICY IF EXISTS "scrape_queue_insert" ON scrape_queue;
CREATE POLICY "scrape_queue_insert"
  ON scrape_queue FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');
