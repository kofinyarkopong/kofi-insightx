// ─────────────────────────────────────────────────────────────────────────────
// Forebet API routes
// GET  /api/forebet?date=YYYY-MM-DD         — fetch fixtures
// POST /api/forebet/manual                  — parse manually pasted text
// POST /api/forebet/deep-verify             — deep-verify shortlist
// DELETE /api/forebet/cache?date=YYYY-MM-DD — clear cache for a date
// GET  /api/forebet/robots                  — proxy Forebet robots.txt check
//
// ── Deployment modes ──────────────────────────────────────────────────────────
//
// LOCAL (bash start.sh on Mac):
//   GET /api/forebet  → Playwright scrapes Forebet on this Mac.
//   If SUPABASE_URL + SUPABASE_SERVICE_KEY are set in backend/.env, results are
//   also upserted to Supabase so the Vercel deployment sees fresh data.
//   (You can also run `npm run scrape` as a standalone CLI command.)
//
// VERCEL (cloud deployment):
//   GET /api/forebet  → reads from Supabase scrape_results table.
//   Playwright never runs on Vercel.  Run `npm run scrape` on your Mac first.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { fetchWithPlaywright } from '../fetcher/playwrightFetcher';
import { fetchStaticHTML } from '../fetcher/cheerioParseFallback';
import { parseForebetHTML, parseManualPaste } from '../parser/fixtureParser';
import { deepVerifyShortlist } from '../deepVerify/deepVerifier';
import { readCache, writeCache, clearCache } from '../fetcher/cache';
import { supabase } from '../lib/supabase';
import type { FetchResult } from '../types/Fixture';
import type { Fixture } from '../types/Fixture';

const router = Router();

// ── GET /api/forebet ──────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const dateParam      = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  const refresh        = req.query.refresh === 'true';
  const penaliseWomens = req.query.penaliseWomens === 'true';

  // Validate date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    return;
  }

  // ── VERCEL MODE: read from Supabase (Playwright not available on Vercel) ──
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    if (!supabase) {
      res.status(503).json({
        error: 'Supabase is not configured on this Vercel deployment. ' +
               'Add SUPABASE_URL and SUPABASE_SERVICE_KEY to your Vercel environment variables.',
        manualFallback: true,
      });
      return;
    }

    const { data, error: dbError } = await supabase
      .from('scrape_results')
      .select('*')
      .eq('date', dateParam)
      .single();

    if (dbError || !data) {
      res.status(404).json({
        error: `No scraped data found for ${dateParam}. ` +
               'Run "npm run scrape" (or "npm run scrape -- ' + dateParam + '") ' +
               'on your Mac to fetch and push this date\'s fixtures.',
        manualFallback: true,
      });
      return;
    }

    const result: FetchResult = {
      fixtures:     data.fixtures as Fixture[],
      fetchedAt:    data.scraped_at,
      date:         data.date,
      totalParsed:  data.fixture_count ?? (data.fixtures as Fixture[]).length,
      fromCache:    false,
      method:       data.method as FetchResult['method'],
      warnings:     data.warnings ?? [],
    };

    res.json(result);
    return;
  }

  // ── LOCAL MODE: Playwright on Mac ─────────────────────────────────────────

  // Serve from local file cache unless refresh requested
  if (!refresh) {
    const cached = readCache(dateParam);
    if (cached) {
      const result: FetchResult = {
        fixtures:    cached.fixtures,
        fetchedAt:   cached.fetchedAt,
        date:        cached.date,
        totalParsed: cached.fixtures.length,
        fromCache:   true,
        method:      cached.method as FetchResult['method'],
        warnings:    cached.warnings,
      };
      res.json(result);
      return;
    }
  }

  let html    = '';
  let method: FetchResult['method'] = 'playwright';
  const warnings: string[] = [];

  // 1. Playwright (local Mac)
  try {
    console.log(`[API] Fetching ${dateParam} via Playwright`);
    const pw = await fetchWithPlaywright(dateParam);
    html = pw.html;
    warnings.push(...pw.warnings);
    if (pw.clickCount > 0) {
      warnings.push(`Loaded full catalogue via ${pw.clickCount} ltodrows click(s).`);
    }
  } catch (pwErr) {
    warnings.push(`Playwright failed: ${(pwErr as Error).message}. Falling back to static fetch.`);
    console.error('[API] Playwright error:', (pwErr as Error).message);
  }

  // 2. Cheerio static fetch fallback (if Playwright failed)
  if (!html) {
    try {
      console.log(`[API] Fetching ${dateParam} via static HTML`);
      const cf = await fetchStaticHTML(dateParam);
      html   = cf.html;
      method = 'cheerio';
      warnings.push(...cf.warnings);
    } catch (cfErr) {
      warnings.push(`Static fetch failed: ${(cfErr as Error).message}`);
      console.error('[API] Cheerio error:', (cfErr as Error).message);
    }
  }

  if (!html) {
    res.status(503).json({
      error:           'Automatic fetch failed. Please use the manual paste fallback.',
      warnings,
      manualFallback:  true,
    });
    return;
  }

  // Parse HTML
  const { fixtures, needsReview, warnings: parseWarnings } =
    parseForebetHTML(html, dateParam, penaliseWomens);

  warnings.push(...parseWarnings);

  const allFixtures: Fixture[] = [...fixtures, ...needsReview];

  // Persist to local file cache
  writeCache(dateParam, {
    date:      dateParam,
    fetchedAt: new Date().toISOString(),
    fixtures:  allFixtures,
    warnings,
    method,
  });

  // Also push to Supabase (if configured) so Vercel can read it immediately
  if (supabase) {
    supabase
      .from('scrape_results')
      .upsert({
        date:          dateParam,
        fixtures:      allFixtures,
        method,
        warnings,
        scraped_at:    new Date().toISOString(),
        fixture_count: allFixtures.length,
      }, { onConflict: 'date' })
      .then(({ error: sbErr }) => {
        if (sbErr) {
          console.warn('[API] Supabase upsert warning:', sbErr.message);
        } else {
          console.log(`[API] Pushed ${allFixtures.length} fixtures to Supabase for ${dateParam}.`);
        }
      });
  }

  const result: FetchResult = {
    fixtures:    allFixtures,
    fetchedAt:   new Date().toISOString(),
    date:        dateParam,
    totalParsed: allFixtures.length,
    fromCache:   false,
    method,
    warnings,
  };

  res.json(result);
});

// ── POST /api/forebet/manual ──────────────────────────────────────────────────

router.post('/manual', (req: Request, res: Response): void => {
  const { text, date, penaliseWomens } = req.body as {
    text:            string;
    date?:           string;
    penaliseWomens?: boolean;
  };

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Request body must include a "text" string.' });
    return;
  }

  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const { fixtures, needsReview, warnings } = parseManualPaste(text, targetDate, penaliseWomens ?? false);
  const allFixtures = [...fixtures, ...needsReview];

  const result: FetchResult = {
    fixtures:    allFixtures,
    fetchedAt:   new Date().toISOString(),
    date:        targetDate,
    totalParsed: allFixtures.length,
    fromCache:   false,
    method:      'manual',
    warnings,
  };

  res.json(result);
});

// ── POST /api/forebet/deep-verify ────────────────────────────────────────────

router.post('/deep-verify', async (req: Request, res: Response): Promise<void> => {
  const { fixtures } = req.body as { fixtures: Fixture[] };

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    res.status(400).json({ error: 'Request body must include a non-empty "fixtures" array.' });
    return;
  }

  if (fixtures.length > 10) {
    res.status(400).json({ error: 'Deep verify is limited to 10 fixtures at a time.' });
    return;
  }

  try {
    const results = await deepVerifyShortlist(fixtures);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── DELETE /api/forebet/cache ─────────────────────────────────────────────────

router.delete('/cache', (req: Request, res: Response): void => {
  const dateParam = req.query.date as string;
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    res.status(400).json({ error: 'Invalid or missing date parameter.' });
    return;
  }
  clearCache(dateParam);
  res.json({ cleared: true, date: dateParam });
});

// ── GET /api/forebet/robots ───────────────────────────────────────────────────

router.get('/robots', async (_req: Request, res: Response): Promise<void> => {
  try {
    const https = await import('https');
    const text = await new Promise<string>((resolve, reject) => {
      https.default.get('https://www.forebet.com/robots.txt', r => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        r.on('error', reject);
      }).on('error', reject);
    });
    res.type('text/plain').send(text);
  } catch {
    res.status(502).send('Could not fetch robots.txt');
  }
});

export default router;
