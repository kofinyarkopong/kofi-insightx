// ─────────────────────────────────────────────────────────────────────────────
// Cheerio static-fetch fallback (no JavaScript execution)
// Used when Playwright is unavailable or fails.
// ─────────────────────────────────────────────────────────────────────────────

import https from 'https';
import http from 'http';

export interface StaticFetchResult {
  html: string;
  method: 'cheerio';
  warnings: string[];
}

function buildUrl(date?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!date || date === today) {
    return 'https://www.forebet.com/en/football-tips-and-predictions-for-today';
  }
  return `https://www.forebet.com/en/football-predictions/predictions-${date}`;
}

export function fetchStaticHTML(date?: string): Promise<StaticFetchResult> {
  const url = buildUrl(date);
  const warnings: string[] = [];

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'identity',
        Connection: 'close',
      },
    };

    console.log(`[Cheerio] Static fetch: ${url}`);

    const req = lib.get(url, options, res => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`[Cheerio] Redirect to ${res.headers.location}`);
        res.resume();
        fetchStaticHTML(res.headers.location as string)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode === 403 || res.statusCode === 429) {
        warnings.push(`Server returned ${res.statusCode} — automated fetching may be blocked.`);
        resolve({ html: '', method: 'cheerio', warnings });
        return;
      }

      if (res.statusCode !== 200) {
        warnings.push(`Unexpected HTTP status: ${res.statusCode}`);
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf-8');
        if (!html.includes('forebet') && !html.includes('rcnt')) {
          warnings.push(
            'Static HTML does not appear to contain Forebet fixture data — ' +
            'JavaScript rendering may be required. Use the Playwright fetcher.'
          );
        }
        resolve({ html, method: 'cheerio', warnings });
      });
    });

    req.on('error', err => {
      warnings.push(`Network error: ${err.message}`);
      resolve({ html: '', method: 'cheerio', warnings });
    });

    req.setTimeout(15_000, () => {
      req.destroy();
      warnings.push('Static fetch timed out after 15 s.');
      resolve({ html: '', method: 'cheerio', warnings });
    });
  });
}
