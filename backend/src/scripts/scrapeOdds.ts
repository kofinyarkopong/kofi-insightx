// ─────────────────────────────────────────────────────────────────────────────
// Mac Odds Scraper Script
//
// Scrapes Flashscore 1X2 odds via Playwright and pushes to Supabase.
// Run from backend/ directory:
//
//   npm run scrape-odds               ← today's odds
//   npm run scrape-odds -- 2026-05-25 ← specific date
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env
// ─────────────────────────────────────────────────────────────────────────────

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';
import { fetchFlashscoreOdds } from '../fetcher/flashscoreFetcher';

const dateArg = process.argv[2];
const date    = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg)
  ? dateArg
  : new Date().toISOString().slice(0, 10);

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n[scrape-odds] ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env\n');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n[scrape-odds] ── Dr Kofi InsightX — Flashscore Odds Scraper ──────────`);
  console.log(`[scrape-odds] Target date : ${date}`);
  console.log(`[scrape-odds] Source      : flashscore.com/football/#/odds/1x2-odds/full-time\n`);

  const result = await fetchFlashscoreOdds(date);

  console.log(`[scrape-odds] Scraped     : ${result.totalFound} rows`);
  console.log(`[scrape-odds] Valid       : ${result.rows.length}`);
  console.log(`[scrape-odds] Skipped     : ${result.skipped}`);
  if (result.warnings.length) {
    result.warnings.forEach(w => console.warn(`[scrape-odds] warning: ${w}`));
  }

  if (result.rows.length === 0) {
    console.error('[scrape-odds] No fixtures to push. Exiting.');
    process.exit(1);
  }

  console.log(`[scrape-odds] Pushing to Supabase...`);
  const { error } = await supabase
    .from('odds_results')
    .upsert({
      date,
      fixtures:      result.rows,
      scraped_at:    result.scrapedAt,
      fixture_count: result.rows.length,
      warnings:      result.warnings,
    }, { onConflict: 'date' });

  if (error) {
    console.error(`[scrape-odds] Supabase error: ${error.message}`);
    process.exit(1);
  }

  console.log(`[scrape-odds] Done — ${result.rows.length} odds fixtures saved for ${date}.`);
  console.log(`[scrape-odds] Open your Vercel URL → Odds Scanner → Fetch from Flashscore.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('[scrape-odds] Fatal:', (err as Error).message);
  process.exit(1);
});
