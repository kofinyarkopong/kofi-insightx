// ─────────────────────────────────────────────────────────────────────────────
// Mac scraper script — runs Playwright locally and pushes results to Supabase.
//
// Usage (from the backend/ directory):
//   npm run scrape                      ← scrapes today's fixtures
//   npm run scrape -- 2026-05-25        ← scrapes a specific date
//
// Prerequisites:
//   • SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env
//   • Playwright Chromium installed: npx playwright install chromium
//
// The script exits with code 0 on success, 1 on failure so it can be used in
// shell scripts or cron jobs.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'path';
import dotenv from 'dotenv';

// Load .env before importing anything that reads process.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';
import { fetchWithPlaywright } from '../fetcher/playwrightFetcher';
import { parseForebetHTML } from '../parser/fixtureParser';
import type { ScrapeResultRow } from '../lib/supabase';

// ── Date argument ─────────────────────────────────────────────────────────────

const dateArg = process.argv[2];
const date    = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg)
  ? dateArg
  : new Date().toISOString().slice(0, 10);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Guard: require Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '\n[scrape] ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env\n' +
      '  Copy backend/.env.example to backend/.env and fill in your Supabase credentials.\n'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n[scrape] ── Dr Kofi InsightX — Mac Scraper ─────────────────────────`);
  console.log(`[scrape] Target date : ${date}`);
  console.log(`[scrape] Launching Playwright on this Mac...\n`);

  // 1. Fetch HTML via Playwright
  const pw = await fetchWithPlaywright(date);

  console.log(`[scrape] Playwright done.`);
  console.log(`[scrape]   ltodrows clicks : ${pw.clickCount}`);
  if (pw.warnings.length) {
    pw.warnings.forEach(w => console.warn(`[scrape]   warning: ${w}`));
  }

  // 2. Parse fixtures from the HTML
  console.log(`[scrape] Parsing fixture rows...`);
  const penaliseWomens = false;
  const { fixtures, needsReview, warnings: parseWarnings } =
    parseForebetHTML(pw.html, date, penaliseWomens);

  const allFixtures = [...fixtures, ...needsReview];
  const allWarnings = [...pw.warnings, ...parseWarnings];

  console.log(`[scrape] Parsed ${fixtures.length} fixtures + ${needsReview.length} needing review`);
  console.log(`[scrape] Total  : ${allFixtures.length} fixtures`);

  // 3. Upsert to Supabase
  console.log(`[scrape] Pushing to Supabase (date=${date})...`);

  const row: ScrapeResultRow = {
    date,
    fixtures:      allFixtures as unknown[],
    method:        'playwright',
    warnings:      allWarnings,
    scraped_at:    new Date().toISOString(),
    fixture_count: allFixtures.length,
  };

  const { error } = await supabase
    .from('scrape_results')
    .upsert(row, { onConflict: 'date' });

  if (error) {
    console.error(`[scrape] Supabase upsert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`[scrape] Done — ${allFixtures.length} fixtures saved to Supabase for ${date}.`);
  console.log(`[scrape] Open your Vercel URL and click "Fetch Forebet Games" to see them.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('[scrape] Fatal error:', (err as Error).message);
  process.exit(1);
});
