// ─────────────────────────────────────────────────────────────────────────────
// Playwright-based Forebet fetcher
//
// Local  → full `playwright` package with its bundled Chromium.
// Vercel → `playwright-core` + `@sparticuz/chromium-min`, which downloads a
//          serverless-optimised Chromium binary from GitHub on cold-start
//          and caches it in /tmp for subsequent invocations.
//
// Forebet's "load more" mechanism is a plain <span onclick="ltodrows(...)">
// inside div#mrows — NOT infinite scroll.  We click it in a loop until it
// disappears, then capture the full page HTML.
//
// Click timing:
//   Local   : MAX_CLICK_ATTEMPTS=80, CLICK_WAIT_MS=5500
//   Vercel  : MAX_CLICK_ATTEMPTS=40, CLICK_WAIT_MS=3500
//   (Override either via env var of the same name.)
//
// Vercel timeouts:
//   Hobby plan  : 60 s  → fits ~12 clicks before timeout warning appears
//   Pro plan    : 300 s → fits 40+ clicks comfortably
// ─────────────────────────────────────────────────────────────────────────────

import type { Browser, Page } from 'playwright-core';

// ── Environment ───────────────────────────────────────────────────────────────

const IS_VERCEL = !!process.env.VERCEL;
const HEADED    = process.env.PLAYWRIGHT_HEADED === 'true';

// Chromium 148 release from @sparticuz — matches playwright-core 1.60.x
const CHROMIUM_BINARY_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.tar';

const MAX_CLICK_ATTEMPTS = parseInt(
  process.env.MAX_CLICK_ATTEMPTS ?? (IS_VERCEL ? '40' : '80'),
  10
);
const CLICK_WAIT_MS = parseInt(
  process.env.CLICK_WAIT_MS ?? (IS_VERCEL ? '3500' : '5500'),
  10
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlaywrightFetchResult {
  html:         string;
  fixtureCount: number;
  clickCount:   number;
  method:       'playwright';
  warnings:     string[];
}

// ── Browser launch ────────────────────────────────────────────────────────────

async function launchBrowser(): Promise<Browser> {
  if (IS_VERCEL) {
    console.log('[Playwright] Vercel mode — loading @sparticuz/chromium-min');
    const chromium           = (await import('@sparticuz/chromium-min')).default;
    const { chromium: core } = await import('playwright-core');

    const execPath = await chromium.executablePath(CHROMIUM_BINARY_URL);
    console.log(`[Playwright] Executable: ${execPath}`);

    return core.launch({
      args:           chromium.args,
      executablePath: execPath,
      headless:       true,
    });
  }

  console.log('[Playwright] Local mode — using bundled Chromium');
  const { chromium } = await import('playwright');
  return chromium.launch({
    headless: !HEADED,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function clickLoadMore(page: Page): Promise<'clicked' | 'not-found'> {
  return page.evaluate((): 'clicked' | 'not-found' => {
    const btn =
      (document.querySelector('#mrows span[onclick^="ltodrows"]') ??
       document.querySelector('span[onclick^="ltodrows"]')) as HTMLElement | null;

    if (!btn || btn.offsetParent === null) return 'not-found';
    btn.click();
    return 'clicked';
  });
}

function countRows(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('div.rcnt').length);
}

function buildUrl(date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!date || date === today) {
    return 'https://www.forebet.com/en/football-tips-and-predictions-for-today';
  }
  return `https://www.forebet.com/en/football-predictions/predictions-${date}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchWithPlaywright(date: string): Promise<PlaywrightFetchResult> {
  const url      = buildUrl(date);
  const warnings: string[] = [];
  let   browser: Browser | null = null;

  if (IS_VERCEL) {
    warnings.push(
      `Vercel: @sparticuz/chromium-min active. ` +
      `Max clicks: ${MAX_CLICK_ATTEMPTS}, wait: ${CLICK_WAIT_MS} ms.`
    );
  }

  try {
    browser = await launchBrowser();

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale:     'en-GB',
      viewport:   { width: 1440, height: 900 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(30_000);

    console.log(`[Playwright] Navigating to ${url}`);
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
          console.log(`[Playwright] Cookie dismissed via ${sel}`);
          break;
        }
      } catch { /* not present */ }
    }

    // Wait for first rows
    try {
      await page.waitForSelector('div.rcnt', { timeout: 15_000 });
    } catch {
      warnings.push('Initial fixture rows did not appear within 15 s.');
    }

    // ltodrows click loop
    let clickCount = 0;
    for (let i = 0; i < MAX_CLICK_ATTEMPTS; i++) {
      const result = await clickLoadMore(page);
      if (result === 'not-found') {
        console.log(`[Playwright] Load-more gone after ${clickCount} click(s) — all rows loaded`);
        break;
      }
      clickCount++;
      const before = await countRows(page);
      console.log(`[Playwright] Click ${clickCount}: waiting ${CLICK_WAIT_MS} ms (rows: ${before})`);
      await delay(CLICK_WAIT_MS);
      const after = await countRows(page);
      console.log(`[Playwright] After click ${clickCount}: ${before} → ${after} rows`);
    }

    if (clickCount === MAX_CLICK_ATTEMPTS) {
      warnings.push(
        `Reached max click limit (${MAX_CLICK_ATTEMPTS}).` +
        (IS_VERCEL
          ? ' Set MAX_CLICK_ATTEMPTS env var or upgrade to Vercel Pro for more rows.'
          : ' Some rows may be missing.')
      );
    }

    const fixtureCount = await countRows(page);
    if (fixtureCount === 0) {
      warnings.push(
        'Zero fixture rows found. Forebet may have changed its HTML structure or blocked the request.'
      );
    }

    const html = await page.content();
    console.log(`[Playwright] Done — ${fixtureCount} rows, ${clickCount} click(s)`);
    return { html, fixtureCount, clickCount, method: 'playwright', warnings };

  } finally {
    if (browser) await browser.close().catch(() => null);
  }
}
