// ─────────────────────────────────────────────────────────────────────────────
// Forebet HTML fixture parser — confirmed DOM selectors (verified via live browser inspection)
//
// Real Forebet row structure (each div.rcnt):
//
//   div.rcnt
//   ├── div.stcn
//   │   └── div.shortagDiv          ← league short code ("Ro1", "Ng1", …)
//   ├── div.tnms
//   │   └── div
//   │       └── a.tnmscn            ← match link (href: /en/football/matches/…)
//   │           ├── span.homeTeam   ← home team name
//   │           ├── span.awayTeam   ← away team name
//   │           └── time            ← kick-off "DD/MM/YYYY HH:mm"
//   ├── div.fprc
//   │   ├── span                    ← home win %
//   │   ├── span                    ← draw %
//   │   └── span.fpr                ← away win %
//   ├── div.predict                 ← "1", "X", or "2"
//   ├── div.ex_sc                   ← predicted correct score ("2 - 1")
//   ├── div.avg_sc                  ← average goals ("2.88")
//   ├── div.bigOnly.prmod           ← home-win odds
//   └── div.lscr_td                 ← live/final score
// ─────────────────────────────────────────────────────────────────────────────

import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import type { Fixture } from '../types/Fixture';
import { scoreFixture } from '../scoring/scoringEngine';

// Derive API type from the loader so we don't depend on cheerio's internal
// type-export paths (which vary across minor versions).
type CheerioAPI = ReturnType<typeof cheerio.load>;

const BASE_URL = 'https://www.forebet.com';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(t: string | undefined | null): string {
  return (t ?? '').replace(/\s+/g, ' ').trim();
}

function toNum(s: string | undefined | null): number {
  if (!s) return -1;
  const n = parseFloat(s.replace('%', '').trim());
  return isNaN(n) ? -1 : n;
}

function toOdds(s: string | undefined | null): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.trim());
  return isNaN(n) || n <= 0 ? undefined : n;
}

/** Football scores must be single digits: 0–9 on each side. */
function isFootballScore(score: string): boolean {
  return /^[0-9]\s*-\s*[0-9]$/.test(score);
}

function normaliseScore(raw: string): string {
  return raw.replace(/\s+/g, '').replace('–', '-').trim();
}

/** Parse Forebet time format: "DD/MM/YYYY HH:mm" or just "HH:mm". */
function parseTime(raw: string): { timeGMT: string; date: string | null } {
  raw = raw.trim();
  const full = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})$/);
  if (full) return { timeGMT: full[4], date: `${full[3]}-${full[2]}-${full[1]}` };
  const short = raw.match(/^(\d{2})\/(\d{2})\s+(\d{2}:\d{2})$/);
  if (short) return { timeGMT: short[3], date: `${new Date().getFullYear()}-${short[2]}-${short[1]}` };
  const t = raw.match(/(\d{2}:\d{2})/);
  if (t) return { timeGMT: t[1], date: null };
  return { timeGMT: '', date: null };
}

function detectStatus(text: string): Fixture['status'] {
  const t = text.toLowerCase();
  if (/\bft\b/.test(t) || t.includes('full time') || t.includes('finished')) return 'finished';
  if (/\bht\b/.test(t) || t.includes('half time')) return 'half_time';
  if (/\d{1,3}['′]/.test(t) || t.includes('live') || t.includes('in play')) return 'live';
  return 'upcoming';
}

function detectMinute(text: string): string | undefined {
  const m = text.match(/(\d{1,3})['′]/);
  return m ? m[1] + "'" : undefined;
}

/** Validate & normalise three probability values (must sum ~100, each 0–100). */
function validateProbs(
  h: number, d: number, a: number
): { h: number; d: number; a: number } | null {
  if (h < 0 || d < 0 || a < 0 || h > 100 || d > 100 || a > 100) return null;
  const sum = h + d + a;
  if (sum < 80 || sum > 120 || sum === 0) return null;
  const f = 100 / sum;
  return { h: Math.round(h * f), d: Math.round(d * f), a: Math.round(a * f) };
}

/** Extract 3 probability values from raw text (fallback). */
function extractProbsFromText(text: string): { h: number; d: number; a: number } | null {
  const nums = Array.from(text.matchAll(/\b(\d{1,2})\b/g))
    .map(m => parseInt(m[1], 10))
    .filter(n => n >= 1 && n <= 99);
  for (let i = 0; i <= nums.length - 3; i++) {
    const v = validateProbs(nums[i], nums[i + 1], nums[i + 2]);
    if (v) return v;
  }
  return null;
}

// ── Primary parser: confirmed div.rcnt selectors ──────────────────────────────

export function parseForebetHTML(
  html: string,
  targetDate: string,
  penaliseWomens = false
): { fixtures: Fixture[]; needsReview: Fixture[]; warnings: string[] } {
  const $ = cheerio.load(html);
  const fixtures: Fixture[] = [];
  const needsReview: Fixture[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  // Leaf-level rows only — exclude any div.rcnt that contains other div.rcnt elements
  const rows = $('div.rcnt').filter((_i: number, el: any) => {
    return $(el).find('div.rcnt').length === 0;
  });

  if (rows.length === 0) {
    warnings.push(
      'No div.rcnt rows found — page may not have fully rendered. ' +
      'Use the manual paste fallback or try refreshing.'
    );
    return { fixtures: [], needsReview: [], warnings };
  }

  console.log(`[Parser] Found ${rows.length} div.rcnt rows`);

  rows.each((_i: number, el: any) => {
    try {
      const $row = $(el);

      // ── Team names (confirmed selectors) ──────────────────────────────────
      const homeTeam = clean($row.find('span.homeTeam').first().text());
      const awayTeam = clean($row.find('span.awayTeam').first().text());

      // ── Match link — href: /en/football/matches/... ────────────────────────
      const $matchLink = $row.find('a.tnmscn').first();
      const href = $matchLink.attr('href') ?? '';
      const matchUrl = href ? (href.startsWith('http') ? href : BASE_URL + href) : '';

      // ── Kick-off time — <time> element inside a.tnmscn ────────────────────
      const rawTime = clean($row.find('a.tnmscn time').first().text()) ||
                      clean($row.find('time').first().text());
      const { timeGMT, date: parsedDate } = parseTime(rawTime);
      const date = parsedDate ?? targetDate;

      // ── League — div.shortagDiv inside div.stcn ───────────────────────────
      const league = clean($row.find('div.shortagDiv').first().text());

      // ── Status (live score / FT indicator) ────────────────────────────────
      const liveText = clean($row.find('.lscr_td').first().text());
      const status = detectStatus(liveText || clean($row.find('.lmin_td').first().text()));
      const minute = detectMinute(clean($row.find('.lmin_td').first().text()));

      // ── Probabilities — three <span> elements inside div.fprc ─────────────
      const fprcSpans = $row.find('div.fprc span');
      const h = toNum(clean($(fprcSpans[0]).text()));
      const d = toNum(clean($(fprcSpans[1]).text()));
      const a = toNum(clean($(fprcSpans[2]).text()));
      let probs = validateProbs(h, d, a);
      if (!probs) probs = extractProbsFromText(clean($row.find('div.fprc').text()));

      const homeWinProb = probs?.h ?? 0;
      const drawProb    = probs?.d ?? 0;
      const awayWinProb = probs?.a ?? 0;

      // ── Prediction — div.predict ───────────────────────────────────────────
      let prediction = clean($row.find('div.predict').first().text());
      if (!/^(1X2|12|1X|X2|1|X|2)$/.test(prediction)) prediction = '';

      // ── Correct score — div.ex_sc ──────────────────────────────────────────
      const rawScore = normaliseScore(clean($row.find('div.ex_sc').first().text()));
      const correctScore = isFootballScore(rawScore) ? rawScore : '';

      // ── Average goals — div.avg_sc ─────────────────────────────────────────
      const avgGoals = toNum(clean($row.find('div.avg_sc').first().text()));

      // ── Odds — div.prmod (inside div.bigOnly or standalone) ───────────────
      const odds = toOdds(clean($row.find('div.prmod, .bigOnly.prmod').first().text()));

      // ── Parse confidence ──────────────────────────────────────────────────
      let pc = 100;
      if (!homeTeam)     pc -= 25;
      if (!awayTeam)     pc -= 25;
      if (!probs)        pc -= 20;
      if (!correctScore) pc -= 10;
      if (avgGoals <= 0) pc -= 10;
      if (!timeGMT)      pc -= 10;
      pc = Math.max(0, pc);

      // Deduplicate by matchUrl or home|away|time key
      const dedupKey = matchUrl || `${homeTeam}|${awayTeam}|${timeGMT}`;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);

      const raw: Partial<Fixture> = {
        id: uuidv4(),
        source: 'forebet',
        sourceUrl: matchUrl || `${BASE_URL}/en/football-tips-and-predictions-for-today`,
        date,
        timeGMT,
        league,
        competition: undefined,
        homeTeam,
        awayTeam,
        homeWinProb,
        drawProb,
        awayWinProb,
        prediction,
        correctScore,
        avgGoals,
        odds,
        status,
        minute,
        matchUrl,
        parseConfidence: pc,
        flags: [],
        reason: '',
      };

      const scored = scoreFixture(raw, penaliseWomens);
      if (pc < 60) needsReview.push(scored);
      else fixtures.push(scored);

    } catch (err) {
      warnings.push(`Row parse error: ${(err as Error).message}`);
    }
  });

  console.log(`[Parser] Parsed: ${fixtures.length} valid + ${needsReview.length} needs-review`);
  return { fixtures, needsReview, warnings };
}

// ── Manual paste parser ───────────────────────────────────────────────────────

export function parseManualPaste(
  text: string,
  targetDate: string,
  penaliseWomens = false
): { fixtures: Fixture[]; needsReview: Fixture[]; warnings: string[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fixtures: Fixture[] = [];
  const needsReview: Fixture[] = [];
  const warnings: string[] = [];

  for (const line of lines) {
    if (/^(time|date|league|match|home|away|\s*#)/i.test(line)) continue;

    const timeMatch = line.match(/\b(\d{2}:\d{2})\b/);
    if (!timeMatch) continue;

    const timeGMT = timeMatch[1];

    // Probabilities: three integers summing to ~100
    const nums = Array.from(line.matchAll(/\b(\d{1,2})\b/g))
      .map(m => parseInt(m[1], 10))
      .filter(n => n >= 1 && n <= 99);
    let probs: { h: number; d: number; a: number } | null = null;
    for (let i = 0; i <= nums.length - 3; i++) {
      const v = validateProbs(nums[i], nums[i + 1], nums[i + 2]);
      if (v) { probs = v; break; }
    }

    // Correct score (single-digit each side)
    const scoreMatch = line.match(/\b([0-9])\s*-\s*([0-9])\b/);
    const correctScore = scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : '';

    // Avg goals
    const avgMatch = line.match(/\b(\d\.\d{1,2})\b/);
    const avgGoals = avgMatch ? parseFloat(avgMatch[1]) : 0;

    // Prediction
    const predMatch = line.match(/\b(1X2|12|1X|X2|1|X|2)\b/);
    const prediction = predMatch ? predMatch[1] : '';

    // Teams: text before numeric section
    const beforeNumbers = line.replace(timeGMT, '').replace(/\s+\d[\d\s%.\-]*$/, '').trim();
    const teamParts = beforeNumbers.split(/\s{2,}|\s+-\s+vs\s+-\s+|\s+vs\s+/i);
    const homeTeam = clean(teamParts[0]);
    const awayTeam = clean(teamParts[1] ?? '');

    let pc = 75;
    if (!homeTeam || !awayTeam) pc -= 25;
    if (!correctScore)          pc -= 10;
    if (avgGoals <= 0)          pc -= 10;
    if (!probs)                 pc -= 10;

    const raw: Partial<Fixture> = {
      id: uuidv4(),
      source: 'forebet',
      sourceUrl: `${BASE_URL}/en/football-tips-and-predictions-for-today`,
      date: targetDate,
      timeGMT,
      league: '',
      homeTeam,
      awayTeam,
      homeWinProb: probs?.h ?? 0,
      drawProb:    probs?.d ?? 0,
      awayWinProb: probs?.a ?? 0,
      prediction,
      correctScore,
      avgGoals,
      status: 'upcoming',
      parseConfidence: Math.max(0, pc),
      flags: [],
      reason: '',
    };

    const scored = scoreFixture(raw, penaliseWomens);
    if (pc < 50) needsReview.push(scored);
    else fixtures.push(scored);
  }

  if (fixtures.length === 0 && needsReview.length === 0) {
    warnings.push(
      'No fixtures could be parsed from the pasted text. ' +
      'Ensure each line includes a time (HH:mm) and probability numbers.'
    );
  }

  return { fixtures, needsReview, warnings };
}
