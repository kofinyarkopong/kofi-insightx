'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Supabase client — used by the Mac scraper
// Uses the SERVICE ROLE key so it bypasses RLS and can write freely.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in scraper/.env\n' +
    'Copy scraper/.env.example to scraper/.env and fill in your credentials.'
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

// ── matches ───────────────────────────────────────────────────────────────────

/**
 * Upsert an array of fixture objects into the matches table.
 * Returns the number of rows saved.
 */
async function upsertMatches(fixtures) {
  if (!fixtures.length) return 0;

  const rows = fixtures.map(f => ({
    id:               f.id,
    date:             f.date,
    kickoff_time:     f.kickoffTime ?? null,
    home_team:        f.homeTeam,
    away_team:        f.awayTeam,
    league:           f.league ?? null,
    href:             f.href ?? null,
    home_win_prob:    f.homeWinProb ?? null,
    draw_prob:        f.drawProb ?? null,
    away_win_prob:    f.awayWinProb ?? null,
    predicted_score:  f.predictedScore ?? null,
    avg_goals:        f.avgGoals ?? null,
    prediction:       f.prediction ?? null,
    odds:             f.odds ?? null,
    confidence_score: f.confidenceScore ?? null,
    confidence_tier:  f.confidenceTier ?? null,
    score_breakdown:  f.scoreBreakdown ?? null,
    risk_flags:       f.riskFlags ?? null,
    filter_a:         f.filterA ?? false,
    filter_b:         f.filterB ?? false,
    best_shortlist:   f.bestShortlist ?? false,
    needs_review:     f.needsReview ?? false,
    enriched:         f.enriched ?? false,
    enrichment_data:  f.enrichmentData ?? null,
    source:           f.source ?? 'playwright',
    scraped_at:       new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from('matches')
    .upsert(rows, { onConflict: 'id', count: 'exact' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  return count ?? rows.length;
}

// ── scrape_queue ──────────────────────────────────────────────────────────────

async function claimPendingJob() {
  // Fetch the oldest pending job
  const { data, error } = await supabase
    .from('scrape_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Mark it as running
  await supabase
    .from('scrape_queue')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

async function updateJob(id, fields) {
  const { error } = await supabase
    .from('scrape_queue')
    .update({ ...fields })
    .eq('id', id);
  if (error) console.error('[DB] updateJob error:', error.message);
}

async function completeJob(id, fixturesFound, fixturesSaved) {
  await updateJob(id, {
    status:          'completed',
    completed_at:    new Date().toISOString(),
    fixtures_found:  fixturesFound,
    fixtures_saved:  fixturesSaved,
    progress:        `Done — ${fixturesSaved} fixtures saved`,
  });
}

async function failJob(id, errorMessage) {
  await updateJob(id, {
    status:        'failed',
    completed_at:  new Date().toISOString(),
    error_message: errorMessage,
  });
}

async function setJobProgress(id, progress) {
  await updateJob(id, { progress });
}

module.exports = { supabase, upsertMatches, claimPendingJob, completeJob, failJob, setJobProgress };
