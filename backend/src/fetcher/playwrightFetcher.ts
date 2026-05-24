// ─────────────────────────────────────────────────────────────────────────────
// Playwright-based Forebet fetcher
//
// Forebet's "load more" mechanism is NOT infinite scroll.
// The real trigger is a plain <span onclick="ltodrows(...)"> inside div#mrows.
// Forebet's own JS appends the next batch of fixtures when that span is clicked.
//
// Strategy:
//   1. Navigate to the page and wait for the first batch of fixtures.
//   2. Dismiss the cookie consent banner.
//   3. Loop up to MAX_CLICK_ATTEMPTS times:
//        a. Find span[onclick^="ltodrows"] (inside #mrows or anywhere on page).
//        b. If visible, click it and wait CLICK_WAIT_MS for Forebet to append rows.
//        c. If not found / not visible, all fixtures are loaded — break.
//   4. Capture full page HTML and return.
//
// Polite: 5.5 s between clicks, max 80 attempts.
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';

export interface PlaywrightFetchResult {
  html: string;
  fixtureCount: number;
  clickCount: number;
  method: 'playwright';
  warnings: string[];
}

const MAX_CLICK_ATTEMPTS = 80;
const CLICK_WAIT_MS      = 5500;   // Forebet needs ~5 s to append the next batch
const PAGE_TIMEOUT_MS    = 30_000;
const NAV_TIMEOUT_MS     = 30_000;

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function buildUrl(date?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!date || date === today) {
    return 'https://www.forebet.com/en/football-tips-and-predictions-for-today';
  }
  return `https://www.forebet.com/en/football-predictions/predictions-${date}`;
}

// Count how many fixture rows are currently in the DOM.
async function countFixtures(page: import('playwright').Page): Promise<number> {
  return page.evaluate(() => {
    const selectors = [
      'div.rcnt',
      'tr.rcnt',
      '[class*="rcnt"]',
      '.tn',
      'div[id^="fc"]',
    ];
    let max = 0;
    for (const sel of selectors) {
      try {
        const n = document.querySelectorAll(sel).length;
        if (n > max) max = n;
      } catch { /* skip invalid selectors */ }
    }
    return max;
  });
}

// Click the ltodrows span if present and visible.
// Returns 'clicked' | 'not-found'.
async function clickLoadMore(page: import('playwright').Page): Promise<'clicked' | 'not-found'> {
  return page.evaluate(() => {
    // Primary selector: the dedicated #mrows container on Forebet
    const btn =
      document.querySelector<HTMLElement>('#mrows span[onclick^="ltodrows"]') ??
      document.querySelector<HTMLElement>('span[onclick^="ltodrows"]');

    if (!btn) return 'not-found';

    // offsetParent is null for hidden/display:none elements
    if (btn.offsetParent === null) return 'not-found';

    btn.click();
    return 'clicked';
  });
}

export async function fetchWithPlaywright(
  date?: string
): Promise<PlaywrightFetchResult> {
  const url = buildUrl(date);
  const warnings: string[] = [];
  let clickCount = 0;
  const headed = process.env.PLAYWRIGHT_HEADED === 'true';

  const browser = await chromium.launch({
    headless: !headed,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    viewport: { width: 1440, height: 900 },
  });

  // Suppress webdriver detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  try {
    console.log(`[Playwright] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });

    // Allow JS to settle
    await delay(2500);

    // ── Dismiss cookie consent ───────────────────────────────────────────
    const cookieSelectors = [
      '#onetrust-accept-btn-handler',
      '.fc-cta-consent',
      'button[id*="accept"]',
      'button[class*="accept"]',
      '[aria-label*="Accept"]',
      '[class*="cookie"] button',
      'button:has-text("Accept")',
      'button:has-text("OK")',
    ];
    for (const sel of cookieSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click();
          await delay(800);
          console.log(`[Playwright] Cookie banner dismissed via: ${sel}`);
          break;
        }
      } catch { /* not present */ }
    }

    // ── Wait for first fixture batch ─────────────────────────────────────
    try {
      await page.waitForSelector('div.rcnt, tr.rcnt, [class*="rcnt"]', { timeout: 15_000 });
    } catch {
      warnings.push('Initial fixture rows did not appear within 15 s — page may not have rendered.');
    }

    const initialCount = await countFixtures(page);
    console.log(`[Playwright] Initial fixture count: ${initialCount}`);

    // ── ltodrows click loop ──────────────────────────────────────────────
    // Click span[onclick^="ltodrows"] repeatedly until it disappears.
    // Forebet serves the next batch ~5 s after each click.
    // On a typical day this takes 1–10 clicks for 800–900 fixtures.

    for (let i = 0; i < MAX_CLICK_ATTEMPTS; i++) {
      const result = await clickLoadMore(page);

      if (result === 'not-found') {
        console.log(`[Playwright] ltodrows button gone after ${clickCount} click(s) — full list loaded.`);
        break;
      }

      clickCount++;
      const before = await countFixtures(page);
      console.log(`[Playwright] Click ${clickCount}: waiting ${CLICK_WAIT_MS / 1000} s… (rows so far: ${before})`);
      await delay(CLICK_WAIT_MS);

      const after = await countFixtures(page);
      console.log(`[Playwright] After click ${clickCount}: ${before} → ${after} fixtures`);
    }

    const fixtureCount = await countFixtures(page);
    console.log(`[Playwright] Final fixture count: ${fixtureCount} after ${clickCount} click(s).`);

    if (fixtureCount === 0) {
      warnings.push(
        'Zero fixture rows detected after loading. ' +
        'Forebet may have changed its HTML structure or blocked the request.'
      );
    }

    const html = await page.content();
    await browser.close();

    return { html, fixtureCount, clickCount, method: 'playwright', warnings };

  } catch (err) {
    await browser.close().catch(() => null);
    throw err;
  }
}
