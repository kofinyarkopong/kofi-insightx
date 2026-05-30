// ─────────────────────────────────────────────────────────────────────────────
// Odds Scanner — Export Utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { OddsFixture } from '../types/OddsFixture';

const COLUMNS = [
  'date', 'timeGMT', 'country', 'league', 'homeTeam', 'awayTeam',
  'pick', 'homeOdds', 'drawOdds', 'awayOdds',
  'confidenceScore', 'confidenceGrade', 'passesFilterB',
  'notes', 'riskFlags',
];

function esc(val: unknown): string {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCSV(fixtures: OddsFixture[]): string {
  const header = COLUMNS.join(',');
  const rows   = fixtures.map(f =>
    COLUMNS.map(col => {
      const v = (f as unknown as Record<string, unknown>)[col];
      return esc(Array.isArray(v) ? v.join('; ') : v);
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFilterACSV(fixtures: OddsFixture[], date: string): void {
  const filtered = fixtures.filter(f => f.passesFilterA);
  download(toCSV(filtered), `odds-filter-a-${date}.csv`, 'text/csv');
}

export function exportFilterBCSV(fixtures: OddsFixture[], date: string): void {
  const filtered = fixtures.filter(f => f.passesFilterB);
  download(toCSV(filtered), `odds-filter-b-${date}.csv`, 'text/csv');
}

export function exportAllJSON(fixtures: OddsFixture[], date: string): void {
  download(JSON.stringify(fixtures, null, 2), `odds-all-${date}.json`, 'application/json');
}

export async function copyFixturesToClipboard(fixtures: OddsFixture[]): Promise<boolean> {
  const lines = fixtures.map(f =>
    `${f.timeGMT} GMT | ${f.country} | ${f.league} | ${f.homeTeam} vs ${f.awayTeam} | ${f.pick} | Conf: ${f.confidenceScore} (${f.confidenceGrade})`
  );
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    return true;
  } catch {
    return false;
  }
}
