// ─────────────────────────────────────────────────────────────────────────────
// Export utilities: CSV, JSON, Markdown, Best List text
// ─────────────────────────────────────────────────────────────────────────────

import type { Fixture } from '../types/Fixture';

const CSV_HEADERS = [
  'Time (GMT)', 'League', 'Competition', 'Home Team', 'Away Team',
  'Home Win %', 'Draw %', 'Away Win %', 'Prediction', 'Correct Score',
  'Avg Goals', 'Status', 'Confidence', 'Flags', 'Reason',
];

function escapeCSV(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function toCSV(fixtures: Fixture[]): string {
  const rows = [CSV_HEADERS.join(',')];
  for (const fx of fixtures) {
    rows.push([
      fx.timeGMT,
      fx.league,
      fx.competition ?? '',
      fx.homeTeam,
      fx.awayTeam,
      fx.homeWinProb,
      fx.drawProb,
      fx.awayWinProb,
      fx.prediction,
      fx.correctScore,
      fx.avgGoals,
      fx.status,
      fx.confidenceScore,
      fx.flags.join('; '),
      fx.reason,
    ].map(escapeCSV).join(','));
  }
  return rows.join('\n');
}

export function downloadCSV(fixtures: Fixture[], filename = 'fixtures.csv'): void {
  const csv = toCSV(fixtures);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function downloadJSON(fixtures: Fixture[], filename = 'fixtures.json'): void {
  const blob = new Blob([JSON.stringify(fixtures, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toMarkdownTable(fixtures: Fixture[]): string {
  const cols = ['Time', 'League', 'Home', 'Away', 'H%', 'D%', 'A%', 'Pred', 'Score', 'Avg G', 'Conf'];
  const sep = cols.map(() => '---');
  const rows = fixtures.map(fx => [
    fx.timeGMT,
    fx.league,
    fx.homeTeam,
    fx.awayTeam,
    fx.homeWinProb + '%',
    fx.drawProb + '%',
    fx.awayWinProb + '%',
    fx.prediction,
    fx.correctScore,
    fx.avgGoals.toFixed(2),
    fx.confidenceScore + '/100',
  ].map(v => String(v).replace(/\|/g, '\\|')));

  return [
    '| ' + cols.join(' | ') + ' |',
    '| ' + sep.join(' | ') + ' |',
    ...rows.map(r => '| ' + r.join(' | ') + ' |'),
  ].join('\n');
}

export function toBestListText(fixtures: Fixture[]): string {
  const lines = ['Best Shortlist C', ''];
  fixtures.forEach((fx, i) => {
    lines.push(`${i + 1}. ${fx.homeTeam} vs ${fx.awayTeam}, ${fx.timeGMT} GMT`);
    lines.push(`   League: ${fx.league}`);
    lines.push(`   Home win: ${fx.homeWinProb}%`);
    lines.push(`   Avg goals: ${fx.avgGoals.toFixed(2)}`);
    lines.push(`   Predicted score: ${fx.correctScore}`);
    lines.push(`   Confidence: ${fx.confidenceScore}/100`);
    lines.push(`   Reason: ${fx.reason}`);
    if (fx.flags.length > 0) {
      lines.push(`   Flags: ${fx.flags.join(', ')}`);
    }
    lines.push('');
  });
  return lines.join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}
