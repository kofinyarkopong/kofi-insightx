// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser + GMT Converter
//
// Accepts the user's uploaded CSV and returns normalised OddsFixture objects.
// All kick-off times are converted to GMT.
//
// Expected CSV columns (case-insensitive, order-independent):
//   date, time, country, league, home_team, away_team,
//   home_odds, draw_odds, away_odds
//
// Optional columns:
//   over_15_odds, home_form, away_form, home_scoring,
//   away_scoring, timezone
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type { OddsFixture, RawCsvRow, CsvParseResult } from '../types/OddsFixture';
import { scoreOddsFixture } from './oddsFilters';

// ── Timezone offset map (hours from UTC) ─────────────────────────────────────
// Covers the most common football timezones.  Extend as needed.
const TZ_OFFSETS: Record<string, number> = {
  'UTC': 0, 'GMT': 0,
  'Europe/London': 0,          // UTC in winter, BST (+1) in summer — simplified
  'Europe/Paris': 1,           // CET
  'Europe/Berlin': 1,
  'Europe/Madrid': 1,
  'Europe/Rome': 1,
  'Europe/Amsterdam': 1,
  'Europe/Brussels': 1,
  'Europe/Lisbon': 0,
  'Europe/Moscow': 3,
  'Europe/Istanbul': 3,
  'Europe/Athens': 2,
  'Europe/Warsaw': 1,
  'Europe/Bucharest': 2,
  'Europe/Kiev': 2,
  'Europe/Minsk': 3,
  'Africa/Accra': 0,
  'Africa/Lagos': 1,
  'Africa/Nairobi': 3,
  'Africa/Johannesburg': 2,
  'Africa/Cairo': 2,
  'America/New_York': -5,
  'America/Chicago': -6,
  'America/Los_Angeles': -8,
  'America/Sao_Paulo': -3,
  'Asia/Dubai': 4,
  'Asia/Kolkata': 5.5,
  'Asia/Tokyo': 9,
  'Asia/Seoul': 9,
  'Asia/Shanghai': 8,
  'Australia/Sydney': 11,
};

/**
 * Converts a time string (HH:MM) from a given timezone to GMT.
 * If the timezone is unknown or the time is invalid, returns the original time
 * with a warning flag.
 */
export function toGMT(time: string, timezone: string): { timeGMT: string; warning?: string } {
  if (!time) return { timeGMT: '00:00', warning: 'Missing time' };

  const match = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return { timeGMT: time, warning: `Cannot parse time: ${time}` };

  const hours   = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const tzKey   = timezone?.trim() || 'GMT';
  const offset  = TZ_OFFSETS[tzKey];

  if (offset === undefined) {
    // Unknown timezone — return as-is with warning
    return { timeGMT: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, warning: `Unknown timezone: ${tzKey} — time not converted` };
  }

  // Convert: subtract offset to get UTC
  const totalMins = hours * 60 + minutes - Math.round(offset * 60);
  const gmtMins   = ((totalMins % 1440) + 1440) % 1440; // wrap around midnight
  const gmtH      = Math.floor(gmtMins / 60);
  const gmtM      = gmtMins % 60;

  return {
    timeGMT: `${String(gmtH).padStart(2, '0')}:${String(gmtM).padStart(2, '0')}`,
  };
}

/**
 * Parses a raw odds string to a float.
 * Returns null if invalid, missing, or zero.
 */
function parseOdds(raw?: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const n = parseFloat(raw.replace(',', '.').trim());
  if (isNaN(n) || n <= 0 || n > 1000) return null;
  return n;
}

/**
 * Normalises CSV header names so the parser is tolerant of variations.
 * E.g. "Home Odds", "HomeOdds", "home_odds" → "home_odds"
 */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s-]/g, '_');
}

/**
 * Parses the raw CSV text into an array of raw row objects.
 * Handles quoted fields and varied line endings.
 */
function parseCsvText(text: string): RawCsvRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Header row
  const headers = lines[0].split(',').map(h => normaliseKey(h.replace(/^"|"$/g, '').trim()));

  const rows: RawCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every(c => !c.trim())) continue; // skip blank rows
    const row: RawCsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').replace(/^"|"$/g, '').trim();
    });
    rows.push(row);
  }
  return rows;
}

/** Splits a CSV line respecting quoted commas. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// Countries excluded by default
const DEFAULT_EXCLUDED = ['belarus'];

/**
 * Main entry point: parses CSV text and returns fully-scored OddsFixture[].
 */
export function parseCsvUpload(
  csvText:          string,
  excludedCountries: string[] = DEFAULT_EXCLUDED,
  marketSource:     string   = 'CSV Upload',
): CsvParseResult {
  const rows          = parseCsvText(csvText);
  const warnings:     string[]  = [];
  const skipped:      string[]  = [];
  const seen          = new Set<string>();
  const fixtures:     OddsFixture[] = [];
  const now           = new Date().toISOString();

  if (rows.length === 0) {
    return { fixtures: [], rowsTotal: 0, rowsValid: 0, rowsSkipped: 0, skippedReasons: ['CSV appears empty or has no data rows'], warnings };
  }

  for (const row of rows) {
    // ── Required fields ──
    const homeTeam = row.home_team ?? row.hometeam ?? '';
    const awayTeam = row.away_team ?? row.awayteam ?? '';
    const country  = (row.country  ?? '').trim();
    const league   = (row.league   ?? '').trim();
    const date     = (row.date     ?? '').trim();

    if (!homeTeam || !awayTeam) { skipped.push(`Row skipped: missing team names (${JSON.stringify(row)})`); continue; }
    if (!date)                   { skipped.push(`Row skipped: missing date for ${homeTeam} v ${awayTeam}`); continue; }

    // ── Country exclusion ──
    if (excludedCountries.some(ex => country.toLowerCase().includes(ex.toLowerCase()))) {
      skipped.push(`${homeTeam} v ${awayTeam} excluded — country: ${country}`);
      continue;
    }

    // ── Odds ──
    const homeOdds = parseOdds(row.home_odds ?? row.homeodds);
    const drawOdds = parseOdds(row.draw_odds ?? row.drawodds);
    const awayOdds = parseOdds(row.away_odds ?? row.awayodds);

    if (homeOdds === null || drawOdds === null || awayOdds === null) {
      skipped.push(`${homeTeam} v ${awayTeam} skipped — odds missing or invalid (home:${row.home_odds} draw:${row.draw_odds} away:${row.away_odds})`);
      continue;
    }

    // ── Deduplication ──
    const dupKey = `${date}|${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
    if (seen.has(dupKey)) { skipped.push(`${homeTeam} v ${awayTeam} on ${date} — duplicate, skipped`); continue; }
    seen.add(dupKey);

    // ── GMT conversion ──
    const timezone = (row.timezone ?? 'GMT').trim();
    const { timeGMT, warning: tzWarning } = toGMT(row.time ?? '00:00', timezone);
    if (tzWarning) warnings.push(tzWarning);

    // ── Optional enrichment ──
    const over15Odds  = parseOdds(row.over_15_odds) ?? undefined;
    const homeScoring = row.home_scoring ? parseInt(row.home_scoring, 10) || undefined : undefined;
    const awayScoring = row.away_scoring ? parseInt(row.away_scoring, 10) || undefined : undefined;

    const raw: Omit<OddsFixture, 'pick' | 'passesFilterA' | 'passesFilterB' | 'filterAReason' | 'filterBReason' | 'notes' | 'riskFlags' | 'confidenceScore' | 'confidenceGrade' | 'oddsStrengthScore' | 'formScore' | 'scoringConsistencyScore' | 'over15Score' | 'opponentWeaknessScore' | 'leagueReliabilityScore' | 'riskPenalty'> = {
      id:          uuidv4(),
      date,
      timeGMT,
      timezone,
      country,
      league,
      homeTeam,
      awayTeam,
      homeOdds,
      drawOdds,
      awayOdds,
      over15Odds,
      homeForm:    row.home_form || undefined,
      awayForm:    row.away_form || undefined,
      homeScoring,
      awayScoring,
      marketSource,
      refreshedAt: now,
    };

    fixtures.push(scoreOddsFixture(raw));
  }

  return {
    fixtures,
    rowsTotal:      rows.length,
    rowsValid:      fixtures.length,
    rowsSkipped:    skipped.length,
    skippedReasons: skipped,
    warnings,
  };
}
