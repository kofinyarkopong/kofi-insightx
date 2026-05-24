'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Full scrape pipeline — orchestrates all stages end-to-end
//
// Stage 1 : scraper.js   — Playwright, loads all Forebet rows
// Stage 2 : extractor.js — Cheerio DOM parsing
// Stage 3 : filters.js   — scoring + filter classification
// Stage 4 : db.js        — upsert to Supabase
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { fetchForebetHTML } = require('./scraper');
const { extractFixtures }  = require('./extractor');
const { applyFilters }     = require('./filters');
const { upsertMatches }    = require('./db');

/**
 * Run the full pipeline for a given date.
 * @param {object}   opts
 * @param {string}   opts.date        YYYY-MM-DD (defaults to today)
 * @param {Function} opts.onProgress  optional progress callback(message)
 * @returns {{ fixturesFound: number, fixturesSaved: number, warnings: string[] }}
 */
async function runPipeline({ date, onProgress = () => {} } = {}) {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const warnings   = [];

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Pipeline] Starting for ${targetDate}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Stage 1 — fetch
  onProgress('Stage 1/4: Fetching Forebet page…');
  const { html, clickCount, warnings: fetchWarnings } =
    await fetchForebetHTML(targetDate, onProgress);

  warnings.push(...fetchWarnings);
  console.log(`[Pipeline] Stage 1 done — ${clickCount} click(s)`);

  // Stage 2 — extract
  onProgress('Stage 2/4: Extracting fixture data…');
  const rawFixtures = extractFixtures(html, targetDate);

  if (!rawFixtures.length) {
    warnings.push('No fixtures extracted. Forebet page may have changed or request was blocked.');
    return { fixturesFound: 0, fixturesSaved: 0, warnings };
  }
  console.log(`[Pipeline] Stage 2 done — ${rawFixtures.length} fixtures`);

  // Stage 3 — score and filter
  onProgress(`Stage 3/4: Scoring ${rawFixtures.length} fixtures…`);
  const scored = applyFilters(rawFixtures);
  console.log('[Pipeline] Stage 3 done');

  // Stage 4 — persist
  onProgress(`Stage 4/4: Saving to Supabase…`);
  const saved = await upsertMatches(scored);
  console.log(`[Pipeline] Stage 4 done — ${saved} rows upserted`);

  onProgress(`Complete — ${saved} fixtures saved`);
  console.log(`\n[Pipeline] Finished. ${rawFixtures.length} found, ${saved} saved.\n`);

  return {
    fixturesFound: rawFixtures.length,
    fixturesSaved: saved,
    warnings,
  };
}

// Allow running directly: node src/pipeline.js [YYYY-MM-DD]
if (require.main === module) {
  const date = process.argv[2] ?? undefined;
  runPipeline({ date, onProgress: msg => console.log(`[Progress] ${msg}`) })
    .then(result => {
      console.log('\nPipeline result:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('\nPipeline failed:', err);
      process.exit(1);
    });
}

module.exports = { runPipeline };
