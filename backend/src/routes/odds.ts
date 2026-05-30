// ─────────────────────────────────────────────────────────────────────────────
// Odds API routes
//
// GET  /api/odds?date=YYYY-MM-DD
//   Local (Mac):  Runs Playwright to scrape Flashscore live, returns fixtures.
//                 Also pushes to Supabase if configured so Vercel sees fresh data.
//   Vercel:       Reads from Supabase odds_results table (no Playwright).
//
// POST /api/odds/push
//   Accepts pre-scraped fixture JSON and upserts to Supabase.
//   Used by the standalone scrapeOdds.ts Mac script.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// Lazy-import the Playwright fetcher only on non-Vercel environments.
// This prevents the build from failing on Vercel where playwright is not installed.
async function getFlashscoreFetcher() {
  if (process.env.VERCEL) return null;
  const mod = await import('../fetcher/flashscoreFetcher');
  return mod.fetchFlashscoreOdds;
}

// ── GET /api/odds ─────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const dateParam = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD.' });
    return;
  }

  const isVercel = !!process.env.VERCEL;

  // ── VERCEL: read from Supabase ────────────────────────────────────────────
  if (isVercel) {
    if (!supabase) {
      res.status(503).json({
        error: 'SUPABASE_URL and SUPABASE_SERVICE_KEY not set on this Vercel deployment.',
        hint:  'Add them in Vercel → Project Settings → Environment Variables.',
      });
      return;
    }

    const { data, error } = await supabase
      .from('odds_results')
      .select('*')
      .eq('date', dateParam)
      .single();

    if (error || !data) {
      res.status(404).json({
        error:   `No odds data found for ${dateParam}.`,
        hint:    'Run "npm run scrape-odds" on your Mac to fetch and push today\'s Flashscore odds.',
        noData:  true,
      });
      return;
    }

    res.json({
      fixtures:    data.fixtures,
      totalFound:  data.fixture_count,
      scrapedAt:   data.scraped_at,
      source:      'supabase',
      warnings:    data.warnings ?? [],
    });
    return;
  }

  // ── LOCAL (Mac): run Playwright scraper live ──────────────────────────────
  const fetchFn = await getFlashscoreFetcher();
  if (!fetchFn) {
    res.status(500).json({ error: 'Playwright fetcher unavailable.' });
    return;
  }

  try {
    console.log(`[API/odds] Scraping Flashscore for ${dateParam}...`);
    const result = await fetchFn(dateParam);

    // Push to Supabase in the background if configured
    if (supabase && result.rows.length > 0) {
      supabase
        .from('odds_results')
        .upsert({
          date:          dateParam,
          fixtures:      result.rows,
          scraped_at:    result.scrapedAt,
          fixture_count: result.rows.length,
          warnings:      result.warnings,
        }, { onConflict: 'date' })
        .then(({ error: e }) => {
          if (e) console.warn('[API/odds] Supabase push warning:', e.message);
          else console.log(`[API/odds] Pushed ${result.rows.length} odds fixtures to Supabase.`);
        });
    }

    res.json({
      fixtures:   result.rows,
      totalFound: result.totalFound,
      skipped:    result.skipped,
      scrapedAt:  result.scrapedAt,
      source:     'playwright',
      warnings:   result.warnings,
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[API/odds] Scrape error:', msg);
    res.status(500).json({ error: `Flashscore scrape failed: ${msg}` });
  }
});

// ── POST /api/odds/push ───────────────────────────────────────────────────────
// Accepts pre-scraped data from the Mac CLI script and upserts to Supabase.

router.post('/push', async (req: Request, res: Response): Promise<void> => {
  const { date, fixtures, scrapedAt, warnings } = req.body as {
    date:      string;
    fixtures:  unknown[];
    scrapedAt: string;
    warnings?: string[];
  };

  if (!date || !Array.isArray(fixtures)) {
    res.status(400).json({ error: 'Body must include date (string) and fixtures (array).' });
    return;
  }

  if (!supabase) {
    res.status(503).json({ error: 'Supabase not configured on this backend.' });
    return;
  }

  const { error } = await supabase
    .from('odds_results')
    .upsert({
      date,
      fixtures,
      scraped_at:    scrapedAt ?? new Date().toISOString(),
      fixture_count: fixtures.length,
      warnings:      warnings ?? [],
    }, { onConflict: 'date' });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ pushed: true, count: fixtures.length, date });
});

export default router;
