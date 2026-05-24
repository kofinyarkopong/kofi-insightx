// ─────────────────────────────────────────────────────────────────────────────
// Deep verify: visits individual Forebet match pages for the shortlist only.
// Extracts trend text, updates reason and confidenceScore.
// Only called when user clicks "Deep Verify Best List".
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import type { Fixture } from '../types/Fixture';
import type { DeepVerifyResult } from '../types/Fixture';

const POLITE_DELAY_MS = 2000; // 2 s between each match page

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchMatchPage(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForSelector('.statarea, .tab_content, .h2harea, .form_area', { timeout: 10_000 }).catch(() => null);
    const html = await page.content();
    await browser.close();
    return html;
  } catch (err) {
    await browser.close().catch(() => null);
    throw err;
  }
}

function extractTrendData(html: string): DeepVerifyResult['trendData'] {
  const $ = cheerio.load(html);

  // Home scoring streak
  const homeScoringEl = $('[class*="home"][class*="scor"], [class*="hscor"], .home_scored').first().text().trim();
  // Away conceding streak
  const awayConcedingEl = $('[class*="away"][class*="conc"], [class*="aconc"], .away_conceded').first().text().trim();
  // Recent form text (e.g. "WWDLW")
  const formEl = $('[class*="form"], .formtable, .last_matches').first().text().trim().replace(/\s+/g, ' ');
  // Over 2.5 trend
  const overEl = $('[class*="over"], [class*="o25"]').first().text().trim();
  // League position
  const posEl = $('[class*="position"], [class*="rank"], .league_pos').first().text().trim();

  return {
    homeScoring:     homeScoringEl || undefined,
    awayConceding:   awayConcedingEl || undefined,
    recentForm:      formEl.substring(0, 200) || undefined,
    overTwoFiveTrend: overEl || undefined,
    leaguePosition:  posEl || undefined,
  };
}

function updateScoreFromTrend(
  fixture: Fixture,
  trendData: DeepVerifyResult['trendData']
): { updatedConfidence: number; updatedReason: string } {
  let bonus = 0;
  const parts: string[] = [];

  if (trendData.homeScoring) {
    parts.push(`Home scoring trend: ${trendData.homeScoring}`);
    if (/[Ww]{3,}/.test(trendData.homeScoring)) bonus += 5;
  }
  if (trendData.awayConceding) {
    parts.push(`Away conceding trend: ${trendData.awayConceding}`);
    bonus += 3;
  }
  if (trendData.recentForm) {
    parts.push(`Recent form: ${trendData.recentForm.substring(0, 80)}`);
    if (/W.*W.*W/i.test(trendData.recentForm)) bonus += 4;
  }
  if (trendData.overTwoFiveTrend) {
    parts.push(`O2.5 trend: ${trendData.overTwoFiveTrend}`);
    bonus += 3;
  }
  if (trendData.leaguePosition) {
    parts.push(`League position: ${trendData.leaguePosition}`);
  }

  const updatedConfidence = Math.min(100, fixture.confidenceScore + bonus);
  const updatedReason = parts.length > 0
    ? `[Deep Verified] ${fixture.reason} | ${parts.join(' | ')}`
    : `[Deep Verified — no new trend data] ${fixture.reason}`;

  return { updatedConfidence, updatedReason };
}

export async function deepVerifyShortlist(
  fixtures: Fixture[]
): Promise<DeepVerifyResult[]> {
  const results: DeepVerifyResult[] = [];

  for (const fixture of fixtures) {
    if (!fixture.matchUrl) {
      results.push({
        id: fixture.id,
        updatedReason: `[Deep Verify skipped — no match URL] ${fixture.reason}`,
        updatedConfidence: fixture.confidenceScore,
        trendData: {},
      });
      continue;
    }

    console.log(`[DeepVerify] Checking ${fixture.homeTeam} vs ${fixture.awayTeam} → ${fixture.matchUrl}`);

    try {
      const html = await fetchMatchPage(fixture.matchUrl);
      const trendData = extractTrendData(html);
      const { updatedConfidence, updatedReason } = updateScoreFromTrend(fixture, trendData);

      results.push({ id: fixture.id, updatedReason, updatedConfidence, trendData });
    } catch (err) {
      console.error(`[DeepVerify] Error for ${fixture.matchUrl}: ${(err as Error).message}`);
      results.push({
        id: fixture.id,
        updatedReason: `[Deep Verify failed — ${(err as Error).message}] ${fixture.reason}`,
        updatedConfidence: fixture.confidenceScore,
        trendData: {},
      });
    }

    // Polite delay between match page requests
    await delay(POLITE_DELAY_MS);
  }

  return results;
}
