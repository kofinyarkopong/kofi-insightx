// ─────────────────────────────────────────────────────────────────────────────
// Supabase admin client — backend (service role, bypasses RLS)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend .env\n' +
    'Copy backend/.env.example to backend/.env and add your Supabase credentials.'
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

/**
 * Upsert an array of fixtures into the matches table.
 * Fixture objects must be plain JS objects (from fixtureParser output).
 */
export async function upsertFixtures(
  fixtures: Record<string, unknown>[],
  date: string
): Promise<number> {
  if (!fixtures.length) return 0;

  const rows = fixtures.map(f => ({
    id:               f.id,
    date,
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
    source:           'manual',
    scraped_at:       new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from('matches')
    .upsert(rows, { onConflict: 'id', count: 'exact' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  return count ?? rows.length;
}
