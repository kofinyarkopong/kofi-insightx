// ─────────────────────────────────────────────────────────────────────────────
// Export utilities — CSV and clipboard export for the three lists
// ─────────────────────────────────────────────────────────────────────────────

import type { Fixture } from '../types/Fixture';

function escCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(fx: Fixture): string {
  return [
    fx.date,
    fx.kickoffTime ?? '',
    fx.league ?? '',
    fx.homeTeam,
    fx.awayTeam,
    fx.homeWinProb ?? '',
    fx.drawProb ?? '',
    fx.awayWinProb ?? '',
    fx.prediction ?? '',
    fx.predictedScore ?? '',
    fx.avgGoals !== null ? fx.avgGoals.toFixed(2) : '',
    fx.confidenceScore,
    fx.confidenceTier,
    fx.filterA ? 'Y' : '',
    fx.filterB ? 'Y' : '',
    fx.bestShortlist ? 'Y' : '',
    (fx.riskFlags ?? []).join(' | '),
  ].map(escCsv).join(',');
}

const CSV_HEADER =
  'Date,Kickoff,League,Home Team,Away Team,H%,D%,A%,Prediction,Score,Avg Goals,' +
  'Confidence,Tier,Filter A,Filter B,Shortlist,Risk Flags';

export function toCsv(fixtures: Fixture[]): string {
  return [CSV_HEADER, ...fixtures.map(row)].join('\n');
}

export function downloadCsv(fixtures: Fixture[], filename: string): void {
  const blob = new Blob([toCsv(fixtures)], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toClipboardText(fixtures: Fixture[]): string {
  return fixtures.map((fx, i) =>
    `${i + 1}. ${fx.homeTeam} vs ${fx.awayTeam}` +
    ` | ${fx.kickoffTime ?? '?'} | ${fx.league ?? '?'}` +
    ` | H:${fx.homeWinProb ?? '?'}% D:${fx.drawProb ?? '?'}% A:${fx.awayWinProb ?? '?'}%` +
    ` | Score: ${fx.predictedScore ?? '?'}` +
    ` | Goals: ${fx.avgGoals !== null ? fx.avgGoals.toFixed(1) : '?'}` +
    ` | Conf: ${fx.confidenceScore}/100 (${fx.confidenceTier})`
  ).join('\n');
}
