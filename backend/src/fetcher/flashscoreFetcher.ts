// ─────────────────────────────────────────────────────────────────────────────
// Flashscore Odds Fetcher
//
// Scrapes 1X2 odds from Flashscore using Playwright.
// Runs on the Mac only — never on Vercel.
//
// Confirmed DOM selectors (verified 2026-05-30):
//   League header container : .headerLeague__wrapper  (inside .sportName.soccer)
//   League header text      : .headerLeague           (combined "LeagueCOUNTRY: 1X2")
//   Match row               : .event__match
//   Kick-off time           : .event__time
//   Home team               : .event__participant--home
//   Away team               : .event__participant--away
//   Odds cells (3)          : .odds__odd  (index 0=home, 1=draw, 2=away)
//   Collapsed section link  : a[class*="show"] or text "display matches"
//
// Architecture note:
//   On the Mac, the button calls GET /api/odds which runs this fetcher directly.
//   Results are also pushed to Supabase so the Vercel deployment can read them.
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
// This fetcher returns RawOddsRow[] — the route/script scores them via the frontend utils.

export interface RawOddsRow {
  id:         string;
  date:       string;   // YYYY-MM-DD
  timeGMT:    string;   // HH:MM (Flashscore shows GMT in the Odds tab)
  country:    string;
  league:     string;
  homeTeam:   string;
  awayTeam:   string;
  homeOdds:   number;
  drawOdds:   number;
  awayOdds:   number;
  marketSource: string;
  refreshedAt:  string;
}

export interface FlashscoreFetchResult {
  rows:       RawOddsRow[];
  totalFound: number;
  skipped:    number;
  warnings:   string[];
  scrapedAt:  string;
}

const FLASHSCORE_ODDS_URL = 'https://www.flashscore.com/football/#/odds/1x2-odds/full-time';
const PAGE_WAIT_MS  = 4000;
const EXPAND_WAIT_MS = 2000;

// ── Country+league parser ─────────────────────────────────────────────────────
// Header text format: "League NameCOUNTRY: 1X2"
// e.g. "Champions League - Play OffsEUROPE: 1X2"
//       "Ligue 1ALGERIA: 1X2"
//       "Primera NacionalARGENTINA: Standings1X2"
//
// Strategy: find the last run of UPPERCASE letters before a colon.
function parseLeagueHeader(raw: string): { country: string; league: string } {
  // Remove trailing "1X2", "Standings", "Draw", "Live Standings" noise
  const cleaned = raw.replace(/\s*(1X2|Standings|Draw|Live Standings|Display matches.*)/gi, '').trim();

  // Match: everything up to last ALL-CAPS word(s) followed by optional whitespace + ":"
  // e.g. "Champions League - Play OffsEUROPE" → league="Champions League - Play Offs", country="EUROPE"
  const match = cleaned.match(/^(.*?)([A-Z][A-Z\s]+):\s*$/);
  if (match) {
    return {
      league:  match[1].trim(),
      country: match[2].trim(),
    };
  }

  // Fallback: try splitting on ":"
  const colonIdx = cleaned.lastIndexOf(':');
  if (colonIdx > 0) {
    return {
      league:  cleaned.slice(0, colonIdx).trim(),
      country: cleaned.slice(colonIdx + 1).trim(),
    };
  }

  return { country: 'Unknown', league: cleaned };
}

function parseOdds(val: string): number | null {
  const n = parseFloat(val.replace(',', '.').trim());
  return isNaN(n) || n <= 0 || n > 100 ? null : n;
}

// ── Main fetcher ──────────────────────────────────────────────────────────────

export async function fetchFlashscoreOdds(
  targetDate?: string
): Promise<FlashscoreFetchResult> {
  const date       = targetDate ?? new Date().toISOString().slice(0, 10);
  const scrapedAt  = new Date().toISOString();
  const warnings:  string[] = [];
  let   skipped    = 0;

  const headed = process.env.PLAYWRIGHT_HEADED === 'true';

  console.log(`[Flashscore] Launching Playwright (headed=${headed})...`);

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });
  const page = await context.newPage();

  try {
    // ── Navigate ──
    await page.goto(FLASHSCORE_ODDS_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(PAGE_WAIT_MS);

    // ── Accept cookie consent if present ──
    try {
      const acceptBtn = page.locator('#onetrust-accept-btn-handler, [id*="accept"], button:has-text("I Accept"), button:has-text("Accept All")').first();
      if (await acceptBtn.isVisible({ timeout: 3000 })) {
        await acceptBtn.click();
        await page.waitForTimeout(1500);
        console.log('[Flashscore] Accepted cookie consent.');
      }
    } catch {
      // No consent banner — carry on
    }

    // ── Click ODDS tab if not already active ──
    try {
      const oddsTab = page.locator('text=ODDS').first();
      if (await oddsTab.isVisible({ timeout: 2000 })) {
        await oddsTab.click();
        await page.waitForTimeout(2000);
        console.log('[Flashscore] Clicked ODDS tab.');
      }
    } catch {
      // Already on odds view
    }

    // ── Expand all collapsed sections ──
    console.log('[Flashscore] Expanding collapsed sections...');
    let expandCount = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      const expandLinks = page.locator('text=/display matches \\(\\d+\\)/i');
      const count = await expandLinks.count();
      if (count === 0) break;
      console.log(`[Flashscore] Found ${count} collapsed section(s) — expanding...`);
      for (let i = 0; i < count; i++) {
        try {
          const link = expandLinks.nth(i);
          if (await link.isVisible({ timeout: 1000 })) {
            await link.click();
            expandCount++;
            await page.waitForTimeout(300);
          }
        } catch { /* skip */ }
      }
      await page.waitForTimeout(EXPAND_WAIT_MS);
    }
    if (expandCount > 0) {
      console.log(`[Flashscore] Expanded ${expandCount} section(s).`);
    }

    // ── Extract all odds data ──
    console.log('[Flashscore] Extracting match data...');

    const rawRows: RawOddsRow[] = await page.evaluate((dateStr) => {
      const results: Array<{
        id: string; date: string; timeGMT: string; country: string; league: string;
        homeTeam: string; awayTeam: string; homeOdds: number; drawOdds: number; awayOdds: number;
        marketSource: string; refreshedAt: string;
      }> = [];

      const now = new Date().toISOString();
      const seen = new Set<string>();

      // Each .sportName.soccer section contains a .headerLeague__wrapper then .event__match rows
      const sections = document.querySelectorAll('.sportName.soccer');

      sections.forEach(section => {
        // Parse league/country from the header
        let country = 'Unknown';
        let league  = 'Unknown';

        const headerEl = section.querySelector('.headerLeague');
        if (headerEl) {
          const raw = headerEl.textContent?.trim() ?? '';
          const cleaned = raw.replace(/\s*(1X2|Standings|Draw|Live Standings)/gi, '').trim();
          const m = cleaned.match(/^(.*?)([A-Z][A-Z\s]+):\s*$/);
          if (m) {
            league  = m[1].trim();
            country = m[2].trim();
          } else {
            const ci = cleaned.lastIndexOf(':');
            if (ci > 0) {
              league  = cleaned.slice(0, ci).trim();
              country = cleaned.slice(ci + 1).trim();
            }
          }
        }

        // Also check headerLeague__wrapper for inline country span
        const countrySpan = section.querySelector('[class*="headerLeague__country"], [class*="header__country"]');
        if (countrySpan) country = countrySpan.textContent?.trim() || country;
        const leagueSpan  = section.querySelector('[class*="headerLeague__name"], [class*="header__name"]');
        if (leagueSpan)  league  = leagueSpan.textContent?.trim()  || league;

        // Skip Belarus
        if (country.toLowerCase().includes('belarus')) return;

        // Match rows
        section.querySelectorAll('.event__match').forEach(row => {
          const time    = row.querySelector('.event__time')?.textContent?.trim() ?? '';
          const homeEl  = row.querySelector('.event__participant--home');
          const awayEl  = row.querySelector('.event__participant--away');
          const homeTeam = homeEl?.textContent?.trim() ?? '';
          const awayTeam = awayEl?.textContent?.trim() ?? '';

          if (!homeTeam || !awayTeam) return;

          // Deduplicate
          const key = `${dateStr}|${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
          if (seen.has(key)) return;
          seen.add(key);

          // Odds
          const oddEls = row.querySelectorAll('.odds__odd');
          const h = parseFloat(oddEls[0]?.textContent?.replace(',', '.').trim() ?? '0');
          const d = parseFloat(oddEls[1]?.textContent?.replace(',', '.').trim() ?? '0');
          const a = parseFloat(oddEls[2]?.textContent?.replace(',', '.').trim() ?? '0');

          if (!h || !d || !a || h <= 0 || d <= 0 || a <= 0) return;

          // Clean time — Flashscore shows local time; we mark timezone as GMT since the
          // site displays in the user's local timezone (set to Europe/London above).
          const cleanTime = time.replace(/[^0-9:]/g, '').slice(0, 5) || '00:00';

          results.push({
            id:          crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
            date:        dateStr,
            timeGMT:     cleanTime,
            country,
            league,
            homeTeam,
            awayTeam,
            homeOdds:    h,
            drawOdds:    d,
            awayOdds:    a,
            marketSource: 'Flashscore',
            refreshedAt:  now,
          });
        });
      });

      return results;
    }, date);

    console.log(`[Flashscore] Extracted ${rawRows.length} rows.`);

    // Filter any remaining invalid rows
    const valid = rawRows.filter(r => r.homeTeam && r.awayTeam && r.homeOdds > 0);
    skipped = rawRows.length - valid.length;

    if (valid.length === 0) {
      warnings.push('No valid odds rows found — Flashscore may have changed its layout or blocked the request.');
    }

    return {
      rows:       valid,
      totalFound: rawRows.length,
      skipped,
      warnings,
      scrapedAt,
    };

  } finally {
    await browser.close();
  }
}
