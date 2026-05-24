'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — Navigate to Forebet and load all fixtures
//
// Uses Playwright (headless Chromium) to open the predictions page, dismiss
// the cookie banner, then click span[onclick^="ltodrows"] inside #mrows up to
// MAX_CLICK_ATTEMPTS times, waiting CLICK_WAIT_MS between each click, until
// the button disappears (all rows loaded) or the limit is hit.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { chromium } = require('playwright');

const MAX_CLICK_ATTEMPTS = parseInt(process.env.MAX_CLICK_ATTEMPTS ?? '80', 10);
const CLICK_WAIT_MS      = parseInt(process.env.CLICK_WAIT_MS ?? '5500', 10);
const HEADED             = process.env.PLAYWRIGHT_HEADED === 'true';

function buildUrl(date) {
  const today = new Date().toISOString().slice(0, 10);
  if (!date || date === today) {
    return 'https://www.forebet.com/en/football-tips-and-predictions-for-today';
  }
  return `https://www.forebet.com/en/football-predictions/predictions-${date}`;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function clickLoadMore(page) {
  return page.evaluate(() => {
    const btn =
      document.querySelector('#mrows span[onclick^="ltodrows"]') ??
      document.querySelector('span[onclick^="ltodrows"]');
    if (!btn || btn.offsetParent === null) return 'not-found';
    btn.click();
    return 'clicked';
  });
}

/**
 * Fetch the fully-loaded Forebet predictions page HTML for a given date.
 * @param {string} date  YYYY-MM-DD (defaults to today)
 * @param {Function} onProgress  optional callback(message) for progress updates
 * @returns {{ html: string, clickCount: number, warnings: string[] }}
 */
async function fetchForebetHTML(date, onProgress = () => {}) {
  const url      = buildUrl(date);
  const warnings = [];
  let   browser  = null;

  try {
    onProgress('Launching Chromium…');
    browser = await chromium.launch({
      headless: !HEADED,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale:     'en-GB',
      timezoneId: 'Europe/London',
      viewport:   { width: 1440, height: 900 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(30_000);

    onProgress(`Navigating to ${url}…`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await delay(2500);

    // Dismiss cookie banner
    const cookieSelectors = [
      '#onetrust-accept-btn-handler',
      '.fc-cta-consent',
      'button:has-text("Accept")',
      'button:has-text("OK")',
      '[aria-label*="Accept"]',
    ];
    for (const sel of cookieSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click();
          await delay(800);
          console.log(`[Scraper] Cookie dismissed via ${sel}`);
          break;
        }
      } catch { /* not present */ }
    }

    // Wait for first batch
    try {
      await page.waitForSelector('div.rcnt', { timeout: 15_000 });
    } catch {
      warnings.push('Initial rows did not appear within 15 s.');
    }

    const initialCount = await page.evaluate(() => document.querySelectorAll('div.rcnt').length);
    onProgress(`Initial rows: ${initialCount}. Loading more…`);

    // ltodrows click loop
    let clickCount = 0;
    for (let i = 0; i < MAX_CLICK_ATTEMPTS; i++) {
      const result = await clickLoadMore(page);
      if (result === 'not-found') {
        console.log(`[Scraper] All rows loaded after ${clickCount} click(s)`);
        break;
      }
      clickCount++;
      const before = await page.evaluate(() => document.querySelectorAll('div.rcnt').length);
      onProgress(`Click ${clickCount} — ${before} rows so far…`);
      await delay(CLICK_WAIT_MS);
      const after = await page.evaluate(() => document.querySelectorAll('div.rcnt').length);
      console.log(`[Scraper] Click ${clickCount}: ${before} → ${after} rows`);
    }

    if (clickCount === MAX_CLICK_ATTEMPTS) {
      warnings.push(`Reached max click limit (${MAX_CLICK_ATTEMPTS}). Some rows may be missing.`);
    }

    const finalCount = await page.evaluate(() => document.querySelectorAll('div.rcnt').length);
    onProgress(`All pages loaded — ${finalCount} rows total`);
    console.log(`[Scraper] Done. ${finalCount} rows, ${clickCount} click(s).`);

    const html = await page.content();
    return { html, clickCount, warnings };

  } finally {
    if (browser) await browser.close().catch(() => null);
  }
}

module.exports = { fetchForebetHTML };
